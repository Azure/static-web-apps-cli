import chalk from "chalk";
import { logger } from "../../core";
import { azureLogin, getStaticSiteDeployment, listResourceGroups, listStaticSites, listSubscriptions, listTenants } from "../../core/account";
import { chooseResourceGroup, chooseStaticSite, chooseSubscription, chooseTenant } from "../../core/prompts";

export async function login(options: SWACLIConfig) {
  try {
    let { credentialChain } = await azureLogin(options.tenantId, options.persist);
    let tenant;

    // If the user has not specified a tenantId, we will prompt them to choose one
    if (!options.tenantId) {
      const tenants = await listTenants(credentialChain);
      if (tenants.length === 0) {
        throw new Error("No tenants found. Aborting.");
      } else if (tenants.length === 1) {
        logger.silly("Only one tenant found", "swa");
        tenant = tenants[0];
      } else {
        tenant = await chooseTenant(tenants, options.tenantId);
        // login again with the new tenant
        // TODO: can we silently authenticate the user with the new tenant?
        ({ credentialChain } = await azureLogin(tenant, options.persist));
      }
    }

    // If the user has not specified a subscriptionId, we will prompt them to choose one
    let subscriptionId = options.subscriptionId;
    if (!subscriptionId) {
      const subscriptions = await listSubscriptions(credentialChain);
      if (subscriptions.length === 0) {
        throw new Error("No subscriptions found. Aborting.");
      } else if (subscriptions.length === 1) {
        logger.silly("Only one subscription found", "swa");
        subscriptionId = subscriptions[0].subscriptionId;
      } else {
        const subscription = await chooseSubscription(subscriptions, options.subscriptionId);
        subscriptionId = subscription.subscriptionId;
      }
    }

    // If the user has not specified a resourceGroup, we will prompt them to choose one
    let resourceGroupName = options.resourceGroup;
    if (!options.resourceGroup) {
      const resourceGroups = await listResourceGroups(credentialChain, subscriptionId);
      if (resourceGroups.length === 0) {
        // TODO: create a new resource group
        throw new Error("No resource groups found. Aborting.");
      } else if (resourceGroups.length === 1) {
        logger.silly("Only one resource group found", "swa");
        resourceGroupName = resourceGroups[0].name;
      } else {
        const resourceGroup = await chooseResourceGroup(resourceGroups, options.resourceGroup);
        resourceGroupName = resourceGroup.name;
      }
    }

    // If the user has not specified a staticSite, we will prompt them to choose one
    let staticSiteName = options.appName;
    if (!options.appName) {
      const staticSites = await listStaticSites(credentialChain, subscriptionId);
      if (staticSites.length === 0) {
        // TODO: create a new static site
        throw new Error("No static sites found. Aborting.");
        process.abort();
      } else if (staticSites.length === 1) {
        logger.silly("Only one static site found", "swa");
        staticSiteName = staticSites[0].name;
      } else {
        const staticSite = await chooseStaticSite(staticSites, options.appName);
        staticSiteName = staticSite.name;
      }
    }

    const deploymentTokenResponse = await getStaticSiteDeployment(credentialChain, subscriptionId, resourceGroupName, staticSiteName);
    if (!deploymentTokenResponse) {
      throw new Error("No deployment token found. Aborting.");
    }

    // logger.log(`Found deployment token:`, "swa");
    // logger.log(` - Token:${deploymentTokenResponse?.properties?.apiKey}`, "swa");

    logger.log(chalk.green(`✔ You have been successfully logged in to Azure.`));
  } catch (error) {
    logger.error((error as any).message, true);
  }
}
