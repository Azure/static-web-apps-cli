import { TenantIdDescription } from "@azure/arm-subscriptions";
import { TokenCredential } from "@azure/identity";
import { logger } from "../../core";
import { azureLogin, listResourceGroups, listStaticSites, listSubscriptions, listTenants } from "../../core/account";
import { chooseResourceGroup, chooseStaticSite, chooseSubscription, chooseTenant } from "../../core/prompts";

export async function login(options: SWACLIConfig) {
  let credentialChain: TokenCredential | undefined = undefined;
  let subscriptionId: string | undefined = undefined;
  let resourceGroupName: string | undefined = undefined;
  let staticSiteName: string | undefined = undefined;
  let tenant: TenantIdDescription | undefined = undefined;

  logger.silly({ options });

  try {
    ({ credentialChain } = await azureLogin(options.tenantId, options.persist));

    // If the user has not specified a tenantId, we will prompt them to choose one
    if (!options.tenantId) {
      const tenants = await listTenants(credentialChain);
      if (tenants.length === 0) {
        throw new Error("No tenants found. Aborting.");
      } else if (tenants.length === 1) {
        logger.silly("A single tenant found", "swa");
        tenant = tenants[0];
      } else {
        tenant = await chooseTenant(tenants, options.tenantId);
        // login again with the new tenant
        // TODO: can we silently authenticate the user with the new tenant?
        ({ credentialChain } = await azureLogin(tenant.tenantId, options.persist));
      }
    }

    logger.silly({ tenant: tenant?.tenantId }, "swa");

    // If the user has not specified a subscriptionId, we will prompt them to choose one
    subscriptionId = options.subscriptionId;
    if (!subscriptionId) {
      const subscriptions = await listSubscriptions(credentialChain);
      if (subscriptions.length === 0) {
        throw new Error("No subscriptions found. Aborting.");
      } else if (subscriptions.length === 1) {
        logger.silly("A single subscription found", "swa");
        subscriptionId = subscriptions[0].subscriptionId;
      } else {
        const subscription = await chooseSubscription(subscriptions, options.subscriptionId);
        subscriptionId = subscription.subscriptionId;
      }
    }

    logger.silly({ subscriptionId }, "swa");

    // If the user has not specified a resourceGroup, we will prompt them to choose one
    resourceGroupName = options.resourceGroup;
    if (!options.resourceGroup) {
      const resourceGroups = await listResourceGroups(credentialChain, subscriptionId);
      if (resourceGroups.length === 0) {
        // TODO: create a new resource group
        throw new Error("No resource groups found. Aborting.");
      } else if (resourceGroups.length === 1) {
        logger.silly("A single resource group found", "swa");
        resourceGroupName = resourceGroups[0].name;
      } else {
        const resourceGroup = await chooseResourceGroup(resourceGroups, options.resourceGroup);
        resourceGroupName = resourceGroup.name;
      }
    }

    logger.silly({ resourceGroupName }, "swa");

    // If the user has not specified a staticSite, we will prompt them to choose one
    staticSiteName = options.appName;
    if (!options.appName) {
      const staticSites = await listStaticSites(credentialChain, subscriptionId);
      if (staticSites.length === 0) {
        // TODO: create a new static site
        throw new Error("No static sites found. Aborting.");
        process.abort();
      } else if (staticSites.length === 1) {
        logger.silly("A single static site found", "swa");
        staticSiteName = staticSites[0].name;
      } else {
        const staticSite = await chooseStaticSite(staticSites, options.appName);
        staticSiteName = staticSite.name;
      }
    }

    logger.silly({ staticSiteName }, "swa");
  } catch (error) {
    logger.error((error as any).message, true);
  }

  logger.silly({ subscriptionId, resourceGroupName, staticSiteName });

  return {
    credentialChain,
    subscriptionId,
    resourceGroupName,
    staticSiteName,
  };
}
