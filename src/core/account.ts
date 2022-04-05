import { WebSiteManagementClient } from "@azure/arm-appservice";
import { GenericResourceExpanded, ResourceManagementClient } from "@azure/arm-resources";
import { Subscription, SubscriptionClient } from "@azure/arm-subscriptions";
import { ChainedTokenCredential, ClientSecretCredential, DeviceCodeCredential, EnvironmentCredential, InteractiveBrowserCredential, TokenCredential, useIdentityPlugin } from "@azure/identity";
import { cachePersistencePlugin } from "@azure/identity-cache-persistence";
import { vsCodePlugin } from "@azure/identity-vscode";
import { logger } from "./utils";
import { isWSL } from "./utils/platform";

export async function azureLogin(details: LoginDetails = {}, persist = false) {
  let tokenCachePersistenceOptions = {
    enabled: false,
    name: "identity.cache",
    // avoid error: Unable to read from the system keyring (libsecret).
    unsafeAllowUnencryptedStorage: false,
  };

  if (persist) {
    if (isWSL()) {
      logger.warn("Authentication cache persistence is not currently supported on WSL.", "swa");
    } else {
      useIdentityPlugin(cachePersistencePlugin);
      useIdentityPlugin(vsCodePlugin);
      tokenCachePersistenceOptions.enabled = true;
    }
  }

  const environmentCredential = new EnvironmentCredential();
  const browserCredential = new InteractiveBrowserCredential({
    redirectUri: "http://localhost:8888",
    tokenCachePersistenceOptions,
    tenantId: details.tenantId,
  });
  const deviceCredential = new DeviceCodeCredential({
    tokenCachePersistenceOptions,
    tenantId: details.tenantId,
  });

  const credentials = [environmentCredential, browserCredential, deviceCredential];

  if (details.tenantId && details.clientId && details.clientSecret) {
    const clientSecretCredential = new ClientSecretCredential(
      details.tenantId,
      details.clientId,
      details.clientSecret,
      { tokenCachePersistenceOptions }
    );
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
    logger.warn("Invalid subscription found. Cannot fetch resource groups", "swa");
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

export async function listStaticSites(credentialChain: TokenCredential, subscriptionId: string | undefined) {
  const staticSites = [];
  if (subscriptionId) {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
    for await (let staticSite of websiteClient.staticSites.list()) {
      staticSites.push(staticSite);
    }
  } else {
    logger.warn("Invalid subscription found. Cannot fetch static sites", "swa");
  }
  return staticSites;
}

export async function getStaticSiteDeployment(
  credentialChain: TokenCredential | undefined,
  subscriptionId: string | undefined,
  resourceGroupName: string | undefined,
  staticSiteName: string | undefined
) {
  if (credentialChain && subscriptionId && resourceGroupName && staticSiteName) {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
    const deploymentTokenResponse = await websiteClient.staticSites.listStaticSiteSecrets(resourceGroupName, staticSiteName);
    return deploymentTokenResponse;
  } else {
    logger.warn("Cannot fetch deployment token", "swa");
    logger.silly({
      subscriptionId,
      resourceGroupName,
      staticSiteName,
    });
  }

  return undefined;
}
