import { StaticSiteARMResource, WebSiteManagementClient } from "@azure/arm-appservice";
import { GenericResourceExpanded, ResourceGroup, ResourceManagementClient } from "@azure/arm-resources";
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
import ora from "ora";
import path from "path";
import { swaCLIEnv } from "./env";
import { chooseProjectName, chooseStaticSite, wouldYouLikeToCreateStaticSite } from "./prompts";
import { swaCliPersistencePlugin } from "./swa-cli-persistence-plugin";
import { dasherize, logger } from "./utils";

const DEFAULT_AZURE_LOCATION = "West US 2";

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

async function isResourceGroupExists(resourceGroupName: string, subscriptionId: string, credentialChain: TokenCredential): Promise<boolean> {
  const client = new ResourceManagementClient(credentialChain, subscriptionId);

  try {
    const rg = await client.resourceGroups.checkExistence(resourceGroupName);
    return rg.body;
  } catch (error: any) {
    if (error?.code?.includes("ResourceGroupNotFound")) {
      return false;
    }
    throw new Error(error);
  }
}

async function createResourceGroup(resourcGroupeName: string, credentialChain: TokenCredential, subscriptionId: string) {
  const client = new ResourceManagementClient(credentialChain, subscriptionId);

  const { AZURE_REGION_LOCATION } = swaCLIEnv();

  const resourceGroupEnvelope: ResourceGroup = {
    location: AZURE_REGION_LOCATION || DEFAULT_AZURE_LOCATION,
  };

  const result = await client.resourceGroups.createOrUpdate(resourcGroupeName, resourceGroupEnvelope);

  logger.silly(result as any);

  return result as GenericResourceExpanded;
}

async function createStaticSite(credentialChain: TokenCredential, subscriptionId: string): Promise<StaticSiteARMResource> {
  const maxProjectNameLength = 60; // azure convention
  const defaultStaticSiteName = dasherize(path.basename(process.cwd())).substring(0, maxProjectNameLength);
  const staticSiteName = await chooseProjectName(defaultStaticSiteName, maxProjectNameLength);
  const resourceGroupName = `${staticSiteName}-rg`;

  let spinner = ora("Creating a new project...").start();

  if (await isResourceGroupExists(resourceGroupName, subscriptionId, credentialChain)) {
    // the same resource group already exists, just assume we can reuse it
    logger.silly(`Resource group "${resourceGroupName}" already exists. Reusing it.`);
  } else {
    // resource group doesn't exist, so create it
    try {
      await createResourceGroup(resourceGroupName, credentialChain, subscriptionId);
    } catch (error) {
      spinner.fail("Project creation failed. Try again.");
      process.exit(1);
    }
  }

  const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);

  const { AZURE_REGION_LOCATION } = swaCLIEnv();

  const staticSiteEnvelope: StaticSiteARMResource = {
    location: AZURE_REGION_LOCATION || DEFAULT_AZURE_LOCATION,
    sku: { name: "Free" },
  };

  logger.silly({
    resourceGroupName,
    name: staticSiteName,
  });
  const result = await websiteClient.staticSites.beginCreateOrUpdateStaticSiteAndWait(resourceGroupName, staticSiteName, staticSiteEnvelope);

  if (result.id) {
    spinner.succeed("Project created successfully.");
  }

  logger.silly(result as any);

  return result as StaticSiteARMResource;
}

async function chooseOrCreateStaticSite(
  options: SWACLIConfig,
  credentialChain: TokenCredential,
  subscriptionId: string
): Promise<StaticSiteARMResource> {
  const staticSites = await listStaticSites(credentialChain, subscriptionId);
  if (staticSites.length === 0) {
    const confirm = await wouldYouLikeToCreateStaticSite?.();

    if (confirm) {
      return await createStaticSite(credentialChain, subscriptionId);
    } else {
      logger.error("No projects found. Create a new prroject and try again.", true);
    }
  } else if (staticSites.length === 1) {
    logger.silly("Only one project found", "swa");
    return staticSites[0];
  }

  const staticSiteName = options.appName;
  const staticSite = await chooseStaticSite(staticSites, staticSiteName);

  if (staticSite === "NEW") {
    return await createStaticSite(credentialChain, subscriptionId);
  }

  return staticSite as StaticSiteARMResource;
}

export async function chooseOrCreateProjectDetails(options: SWACLIConfig, credentialChain: TokenCredential, subscriptionId: string) {
  // if the user has provided a resource group name, we will use it
  let resourceGroupName = options.resourceGroupName;

  // if the user has provided a static site name, we will use it
  let staticSiteName = options.appName;

  const staticSite = await chooseOrCreateStaticSite(options, credentialChain, subscriptionId);

  if (staticSite && staticSite.id) {
    logger.silly(staticSite.id);
    resourceGroupName = staticSite.id.split("/")[3];
    staticSiteName = staticSite.name;
  }

  return {
    resourceGroupName,
    staticSiteName,
  };
}

export async function listTenants(credentialChain: TokenCredential) {
  const client = new SubscriptionClient(credentialChain);
  const tenants = [];
  for await (let tenant of client.tenants.list()) {
    tenants.push(tenant);
  }
  return tenants;
}

export async function listResourceGroups(credentialChain: TokenCredential, subscriptionId: string) {
  const resourceGroups: GenericResourceExpanded[] = [];
  const client = new ResourceManagementClient(credentialChain, subscriptionId);
  for await (let resource of client.resources.list()) {
    resourceGroups.push(resource);
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

export async function listStaticSites(credentialChain: TokenCredential, subscriptionId: string, resourceGroupName?: string) {
  const staticSites = [];
  const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);

  let staticSiteList = websiteClient.staticSites.list();
  if (resourceGroupName) {
    staticSiteList = websiteClient.staticSites.listStaticSitesByResourceGroup(resourceGroupName);
  }

  for await (let staticSite of staticSiteList) {
    staticSites.push(staticSite);
  }
  return staticSites;
}

export async function getStaticSiteDeployment(
  credentialChain: TokenCredential,
  subscriptionId: string,
  resourceGroupName: string,
  staticSiteName: string
) {
  if (!subscriptionId) {
    logger.error("An Azure subscription is required to access your deployment token.", true);
  }
  if (!resourceGroupName) {
    logger.error("A resource group is required to access your deployment token.", true);
  }
  if (!staticSiteName) {
    logger.error("A static site name is required to access your deployment token.", true);
  }

  logger.silly({
    subscriptionId,
    resourceGroupName,
    staticSiteName,
  });

  const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
  const deploymentTokenResponse = await websiteClient.staticSites.listStaticSiteSecrets(resourceGroupName, staticSiteName);
  return deploymentTokenResponse;
}
