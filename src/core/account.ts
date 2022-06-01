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
import { chooseProjectName, chooseStaticSite, wouldYouLikeToCreateStaticSite, wouldYouLikeToOverrideStaticSite } from "./prompts";
import { swaCliPersistencePlugin } from "./swa-cli-persistence-plugin";
import { SWACLIPersistenceCachePlugin } from "./swa-cli-persistence-plugin/persistence-cache-plugin";
import { dasherize, logger } from "./utils";
import { isRunningInDocker } from "./utils/docker";

const DEFAULT_AZURE_LOCATION = "West US 2";

export async function authenticateWithAzureIdentity(details: LoginDetails = {}, useKeychain = true, clearCache = false): Promise<TokenCredential> {
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

    if (clearCache) {
      logger.silly("Clearing keychain credentials");
      await new SWACLIPersistenceCachePlugin(tokenCachePersistenceOptions).clearCache();
    }
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

  // Only use interactive browser credential if we're not running in docker
  const credentials = isRunningInDocker() ? [environmentCredential, deviceCredential] : [environmentCredential, browserCredential, deviceCredential];

  if (details.tenantId && details.clientId && details.clientSecret) {
    const clientSecretCredential = new ClientSecretCredential(details.tenantId, details.clientId, details.clientSecret, {
      tokenCachePersistenceOptions,
    });
    // insert at the beginning of the array to ensure that it is tried first
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

async function gracefullyFail<T>(promise: Promise<T>, errorCode?: number): Promise<T | undefined> {
  try {
    return await promise;
  } catch (error: any) {
    if (errorCode === undefined || (error.statusCode && errorCode === error.statusCode)) {
      logger.silly(`Caught error: ${error.message}`);
      return undefined;
    }
    throw error;
  }
}

async function createStaticSite(options: SWACLIConfig, credentialChain: TokenCredential, subscriptionId: string): Promise<StaticSiteARMResource> {
  let { appName, resourceGroupName } = options;

  const maxProjectNameLength = 63; // azure convention is 64 characters (zero-indexed)
  const defaultStaticSiteName = appName || dasherize(path.basename(process.cwd())).substring(0, maxProjectNameLength);

  appName = await chooseProjectName(defaultStaticSiteName, maxProjectNameLength);
  resourceGroupName = resourceGroupName || `${appName}-rg`;

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

    logger.silly(`Checking if project "${appName}" already exists...`);

    // check if the static site already exists
    const project = await gracefullyFail(websiteClient.staticSites.getStaticSite(resourceGroupName, appName), 404);
    const projectExists = project !== undefined;

    if (projectExists) {
      spinner.stop();

      const confirm = await wouldYouLikeToOverrideStaticSite?.(appName);
      if (confirm === false) {
        return (await chooseOrCreateStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;
      }
    }

    if (projectExists) {
      spinner.start(`Updating project "${appName}"...`);
    }

    logger.silly(`Creating static site "${appName}" in resource group "${resourceGroupName}"...`);
    const result = await websiteClient.staticSites.beginCreateOrUpdateStaticSiteAndWait(resourceGroupName, appName, staticSiteEnvelope);

    logger.silly(`Static site "${appName}" created successfully.`);
    logger.silly(result as any);

    if (result.id) {
      if (projectExists) {
        spinner.succeed(`Project "${appName}" updated successfully.`);
      } else {
        spinner.succeed(chalk.green("Project created successfully!"));
      }
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

  // 1- when there are no static sites
  if (staticSites.length === 0) {
    const confirm = await wouldYouLikeToCreateStaticSite();

    if (confirm) {
      return (await createStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;
    } else {
      logger.error("No projects found. Create a new project and try again.", true);
    }
  }

  // 2- when there is only one static site
  else if (staticSites.length === 1) {
    logger.silly("Only one project found. Trying to use it if the name matches...");

    const staticSite = staticSites[0];
    if (options.appName === staticSite.name) {
      return staticSite;
    } else {
      // if the name doesn't match, ask the user if they want to create a new project
      const confirm = await wouldYouLikeToCreateStaticSite();

      if (confirm) {
        return (await createStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;
      } else {
        logger.error(`The provided project name "${options.appName}" was not found.`, true);
      }
    }
  }

  // 3- when there are multiple static sites

  if (options.appName) {
    // if the user provided a project name, try to find it and use it
    logger.silly(`Looking for project "${options.appName}"...`);
    const staticSite = staticSites.find((s) => s.name === options.appName);
    if (staticSite) {
      return staticSite;
    }
  }

  // otherwise, ask the user to choose one
  const staticSite = await chooseStaticSite(staticSites, options.appName);

  if (staticSite === "NEW") {
    // if the user chose to create a new project, switch to the create project flow
    return (await createStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;
  }

  return staticSites.find((s) => s.name === staticSite) as StaticSiteARMResource;
}

export async function chooseOrCreateProjectDetails(
  options: SWACLIConfig,
  credentialChain: TokenCredential,
  subscriptionId: string,
  shouldPrintToken: boolean | undefined
) {
  const staticSite = (await chooseOrCreateStaticSite(options, credentialChain, subscriptionId)) as StaticSiteARMResource;

  logger.silly("Static site found!");
  logger.silly({ staticSite });

  if (staticSite && staticSite.id) {
    if (!shouldPrintToken && staticSite.provider !== "Custom" && staticSite.provider !== "None") {
      // TODO: add a temporary warning message until we ship `swa link/unlink`
      logger.error(`The project "${staticSite.name}" is linked to "${staticSite.provider}"!`);
      logger.error(`Unlink the project from the "${staticSite.provider}" provider and try again.`, true);
      return;
    }

    // in case we have a static site, we will use its resource group and name
    // get resource group name from static site id:
    //   /subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/swa-resource-groupe-name/providers/Microsoft.Web/sites/swa-static-site
    // 0 /      1      /                   2                /        3     /             4
    const resourceGroupName = staticSite.id.split("/")[4];
    const staticSiteName = staticSite.name;
    return {
      resourceGroupName,
      staticSiteName,
    };
  } else {
    logger.error("No project found. Create a new project and try again.", true);
  }

  return;
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
