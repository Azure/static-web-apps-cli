import { WebSiteManagementClient } from "@azure/arm-appservice";
import { GenericResourceExpanded, ResourceManagementClient } from "@azure/arm-resources";
import { Subscription, SubscriptionClient } from "@azure/arm-subscriptions";
import {
  ChainedTokenCredential,
  ClientSecretCredential,
  DeviceCodeCredential,
  EnvironmentCredential,
  InteractiveBrowserCredential,
  TokenCachePersistenceOptions,
  TokenCredential,
  useIdentityPlugin,
} from "@azure/identity";
import { swaCliPersistencePlugin } from "./swa-cli-persistence-plugin";
import { logger } from "./utils";

export async function authenticateWithAzureIdentity(details: LoginDetails = {}, useKeychain = true) {
  logger.silly("Executing authenticateWithAzureIdentity");
  logger.silly({ details, useKeychain });

  let tokenCachePersistenceOptions: TokenCachePersistenceOptions = {
    enabled: false,
    name: "swa-cli-persistence-plugin",
    unsafeAllowUnencryptedStorage: false,
  };

  if (useKeychain === true) {
    logger.silly("Keychain is enabled");

    useIdentityPlugin(swaCliPersistencePlugin);
    tokenCachePersistenceOptions.enabled = true;
  } else {
    logger.silly("Keychain is disabled");

    tokenCachePersistenceOptions.enabled = false;
  }

  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: `http://localhost:31337`,
    tokenCachePersistenceOptions,
    tenantId: details.tenantId,
  });

  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions,
    tenantId: details.tenantId,
  });

  const environmentCredential = new EnvironmentCredential();

  const credentials = [environmentCredential, browserCredential, deviceCredential];

  if (details.tenantId && details.clientId && details.clientSecret) {
    const clientSecretCredential = new ClientSecretCredential(details.tenantId, details.clientId, details.clientSecret, {
      tokenCachePersistenceOptions,
    });
    credentials.unshift(clientSecretCredential);
  }

  return new ChainedTokenCredential(...credentials);
}

export async function listTenants(credentialChain: TokenCredential) {
  const client = new SubscriptionClient(credentialChain);
  const tenants = [];
  for await (let tenant of client.tenants.list()) {
    tenants.push(tenant);
  }
  return tenants;
}

export async function listResourceGroups(credentialChain: TokenCredential, subscriptionId: string | undefined) {
  const resourceGroups: GenericResourceExpanded[] = [];
  if (subscriptionId) {
    const client = new ResourceManagementClient(credentialChain, subscriptionId);
    for await (let resource of client.resources.list()) {
      resourceGroups.push(resource);
    }
  } else {
    throw new Error("An Azure subscription is required to access your Azure resource groups.");
  }
  return resourceGroups;
}

export async function listSubscriptions(credentialChain: TokenCredential) {
  const subscriptionClient = new SubscriptionClient(credentialChain);
  const subscriptions: Subscription[] = [];
  for await (let subscription of subscriptionClient.subscriptions.list()) {
    subscriptions.push(subscription);
  }
  return subscriptions;
}

export async function listStaticSites(credentialChain: TokenCredential, subscriptionId: string | undefined, _resourceGroupName: string) {
  const staticSites = [];
  if (subscriptionId) {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
    for await (let staticSite of websiteClient.staticSites.list()) {
      staticSites.push(staticSite);
    }
  } else {
    throw new Error("An Azure subscription is required to access your Azure Static Web Apps applications.");
  }
  return staticSites;
}

export async function getStaticSiteDeployment(
  credentialChain: TokenCredential,
  subscriptionId: string | undefined,
  resourceGroupName: string | undefined,
  staticSiteName: string | undefined
) {
  if (subscriptionId && resourceGroupName && staticSiteName) {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
    const deploymentTokenResponse = await websiteClient.staticSites.listStaticSiteSecrets(resourceGroupName, staticSiteName);
    return deploymentTokenResponse;
  } else {
    logger.silly({
      subscriptionId,
      resourceGroupName,
      staticSiteName,
    });
    throw new Error("An Azure subscription is required to access your deployment token.");
  }
}
