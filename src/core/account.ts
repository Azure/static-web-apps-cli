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
import chalk from "chalk";
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

async function createStaticSite(
  credentialChain: TokenCredential,
  subscriptionId: string,
  staticSiteName: string | undefined,
  resourceGroupName: string | undefined
): Promise<StaticSiteARMResource> {
  const maxProjectNameLength = 63; // azure convention is 64 characters (zero-indexed)
  const defaultStaticSiteName = staticSiteName || dasherize(path.basename(process.cwd())).substring(0, maxProjectNameLength);

  staticSiteName = await chooseProjectName(defaultStaticSiteName, maxProjectNameLength);
  resourceGroupName = resourceGroupName || `${staticSiteName}-rg`;

  let spinner = ora("Creating a new project...").start();

  // if the resource group does not exist, create it
  if ((await isResourceGroupExists(resourceGroupName, subscriptionId, credentialChain)) === false) {
    logger.silly(`Resource group "${resourceGroupName}" does not exist. Creating one...`);
    // create the resource group
    await createResourceGroup(resourceGroupName, credentialChain, subscriptionId);
  }

  // create the static web app instance
  try {
    const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);

    const { AZURE_REGION_LOCATION } = swaCLIEnv();

    const staticSiteEnvelope: StaticSiteARMResource = {
      location: AZURE_REGION_LOCATION || DEFAULT_AZURE_LOCATION,
      sku: { name: "Free", tier: "Free" },

      // these are mandatory, otherwise the static site will not be created
      buildProperties: {
        appLocation: "",
        outputLocation: "",
        apiLocation: "",
      },
    };

    logger.silly(`Creating static site "${staticSiteName}" in resource group "${resourceGroupName}"...`);

    const result = await websiteClient.staticSites.beginCreateOrUpdateStaticSiteAndWait(resourceGroupName, staticSiteName, staticSiteEnvelope);

    logger.silly(`Static site "${staticSiteName}" created successfully.`);
    logger.silly(result as any);

    if (result.id) {
      spinner.succeed(chalk.green("Project created successfully!"));
    }

    return result as StaticSiteARMResource;
  } catch (error: any) {
    spinner.fail(chalk.red("Project creation failed."));
    logger.error(error.message, true);
    return undefined as any;
  }
}

async function chooseOrCreateStaticSite(
  options: SWACLIConfig,
  credentialChain: TokenCredential,
  subscriptionId: string
): Promise<string | StaticSiteARMResource> {
  const staticSites = await listStaticSites(credentialChain, subscriptionId);
  if (staticSites.length === 0) {
    const confirm = await wouldYouLikeToCreateStaticSite?.();

    if (confirm) {
      return (await createStaticSite(credentialChain, subscriptionId, options.appName, options.resourceGroupName)) as StaticSiteARMResource;
    } else {
      logger.error("No projects found. Create a new project and try again.", true);
    }
  } else if (staticSites.length === 1) {
    logger.silly("Only one project found. Using it.");
    return staticSites[0].name as string;
  }

  const staticSite = await chooseStaticSite(staticSites, options.appName);

  if (staticSite === "NEW") {
    const confirm = await wouldYouLikeToCreateStaticSite?.();

    if (confirm) {
      return (await createStaticSite(credentialChain, subscriptionId, options.appName, options.resourceGroupName)) as StaticSiteARMResource;
    } else {
      logger.error("No project will be create. Operation canceled. Exit..", true);
    }
  }

  return staticSite as string;
}

export async function chooseOrCreateProjectDetails(options: SWACLIConfig, credentialChain: TokenCredential, subscriptionId: string) {
  // if the user has provided a resource group name, we will use it
  let resourceGroupName = options.resourceGroupName;

  // if the user has provided a static site name, we will use it
  let staticSiteName = options.appName;

  const staticSite = (await chooseOrCreateStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;

  if (staticSite && staticSite.id) {
    logger.silly(staticSite.id);

    // get resource group name from static site id:
    //   /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/swa-resource-groupe-name/providers/Microsoft.Web/sites/swa-static-site
    // 0 /      1      /                   2                /        3     /             4
    resourceGroupName = staticSite.id.split("/")[4];
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
  return staticSites.sort((a, b) => a.name?.localeCompare(b.name!)!);
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

  const websiteClient = new WebSiteManagementClient(credentialChain, subscriptionId);
  const deploymentTokenResponse = await websiteClient.staticSites.listStaticSiteSecrets(resourceGroupName, staticSiteName);
  return deploymentTokenResponse;
}
