import process from 'process';
import { TokenCredential } from "@azure/identity";
import { Command } from "commander";
import { DEFAULT_CONFIG } from "../../config";
import { configureOptions, logger } from "../../core";
import { azureLogin, listResourceGroups, listStaticSites, listSubscriptions, listTenants } from "../../core/account";
import { chooseResourceGroup, chooseStaticSite, chooseSubscription, chooseTenant } from "../../core/prompts";

export default function registerCommand(program: Command) {
  program
    .command("login")
    .usage("[options]")
    .description("login into Azure Static Web Apps")
    .option("--persist", "Enable credentials cache persistence", DEFAULT_CONFIG.persist)
    .option("--subscription [subscriptionId]", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("--resource-group [resourceGroup]", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroup)
    .option("--tenant [tenantId]", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("--client-id [clientId]", "Azure client ID", DEFAULT_CONFIG.clientId)
    .option("--client-secret [clientSecret]", "Azure client secret", DEFAULT_CONFIG.clientSecret)
    .option("--app-name [appName]", "Azure Static Web App application name", DEFAULT_CONFIG.appName)
    .action(async (_options: SWACLIConfig, command: Command) => {
      const config = await configureOptions("./", command.optsWithGlobals(), command);
      await login(config.options);
    })
    .addHelpText(
      "after",
      `
Examples:

  Interactive login
  swa login

  Login into specific tenant
  swa login --tenant 12345678-abcd-0123-4567-abcdef012345

  Login using service principal
  swa login --tenant 12345678-abcd-0123-4567-abcdef012345 \
            --client-id 00000000-0000-0000-0000-000000000000 \
            --client-secret 0000000000000000000000000000000000000000000000000000000000000000
    `
    );
}

export async function login(options: SWACLIConfig) {
  let credentialChain: TokenCredential | undefined = undefined;
  let subscriptionId: string | undefined = undefined;
  let resourceGroupName: string | undefined = undefined;
  let staticSiteName: string | undefined = undefined;
  let tenantId: string | undefined = process.env.AZURE_TENANT_ID ?? options.tenantId;
  let clientId: string | undefined = process.env.AZURE_CLIENT_ID ?? options.clientId;
  let clientSecret: string | undefined = process.env.AZURE_CLIENT_SECRET ?? options.clientSecret;

  logger.silly({ options });

  try {
    credentialChain = await azureLogin({ tenantId, clientId, clientSecret }, options.persist);

    // If the user has not specified a tenantId, we will prompt them to choose one
    if (!tenantId) {
      const tenants = await listTenants(credentialChain);
      if (tenants.length === 0) {
        throw new Error("No tenants found. Aborting.");
      } else if (tenants.length === 1) {
        logger.silly("A single tenant found", "swa");
        tenantId = tenants[0].tenantId;
      } else {
        const tenant = await chooseTenant(tenants, options.tenantId);
        tenantId = tenant.tenantId;
        // login again with the new tenant
        // TODO: can we silently authenticate the user with the new tenant?
        credentialChain = await azureLogin({ tenantId, clientId, clientSecret }, options.persist);
      }
    }

    logger.silly({ tenant: tenantId }, "swa");

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
