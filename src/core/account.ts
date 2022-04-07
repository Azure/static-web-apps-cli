import { WebSiteManagementClient } from "@azure/arm-appservice";
import { GenericResourceExpanded, ResourceManagementClient } from "@azure/arm-resources";
import { Subscription, SubscriptionClient } from "@azure/arm-subscriptions";
import {
  ChainedTokenCredential,
  ClientSecretCredential,
  DeviceCodeCredential,
  EnvironmentCredential,
  InteractiveBrowserCredential,
  TokenCredential,
  useIdentityPlugin,
} from "@azure/identity";
import { cachePersistencePlugin } from "@azure/identity-cache-persistence";
import { vsCodePlugin } from "@azure/identity-vscode";
import { Environment } from "@azure/ms-rest-azure-env";
import { MsalAuthProvider } from "./login/msal-auth-provider";
import { checkRedirectServer } from "./login/server";
import { logger } from "./utils";
import { isWSL } from "./utils/platform";

export async function loginWithMsal(details: LoginDetails = {}, _persist = false): Promise<void> {
  try {
    const environment: Environment = Environment.AzureCloud;

    // const onlineTask: Promise<void> = waitUntilOnline(environment, 2000);
    // const timerTask: Promise<boolean | PromiseLike<boolean> | undefined> = delay(2000, true);

    // if (await Promise.race([onlineTask, timerTask])) {
    //   logger.warn('You appear to be offline. Please check your network connection.');
    //   await onlineTask;
    // }

    const authProvider = new MsalAuthProvider(true);
    const useCodeFlow: boolean = await checkRedirectServer();

    const loginResult = useCodeFlow
      ? await authProvider.login("aebc6443-996d-45c2-90f0-388ff96faa56", environment, "common")
      : await authProvider.loginWithDeviceCode(environment, details.tenantId);

    logger.log({ loginResult });
  } catch (err) {
    throw err;
  }
}

export async function azureLoginWithIdentitySDK(details: LoginDetails = {}, persist = false) {
  let tokenCachePersistenceOptions = {
    enabled: false,
    name: "identity.cache",
    // avoid error: Unable to read from the system keyring (libsecret).
    unsafeAllowUnencryptedStorage: false,
  };

  if (persist) {
    if (isWSL()) {
      logger.warn("Authentication cache persistence is not currently supported on WSL.");
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
    logger.warn("Invalid subscription found. Cannot fetch resource groups");
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

export async function listStaticSites(credentialChain: TokenCredential, subscriptionId: string | undefined, resourceGroupName?: string) {
  const staticSites = [];
  if (subscriptionId) {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
    for await (let staticSite of websiteClient.staticSites.list()) {
      if (resourceGroupName) {
        if (staticSite.id?.includes(`/resourceGroups/${resourceGroupName}/`)) {
          staticSites.push(staticSite);
        }
      } else {
        staticSites.push(staticSite);
      }
    }
  } else {
    logger.warn("Invalid subscription found. Cannot fetch static sites");
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
    logger.warn("Cannot fetch deployment token");
    logger.silly({
      subscriptionId,
      resourceGroupName,
      staticSiteName,
    });
  }

  return undefined;
}
