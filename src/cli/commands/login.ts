import { TokenCredential } from "@azure/identity";
import chalk from "chalk";
import { Command } from "commander";
import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { configureOptions, logger, logGiHubIssueMessageAndExit } from "../../core";
import { authenticateWithAzureIdentity, listResourceGroups, listStaticSites, listSubscriptions, listTenants } from "../../core/account";
import { swaCLIEnv } from "../../core/env";
import { chooseResourceGroup, chooseStaticSite, chooseSubscription, chooseTenant } from "../../core/prompts";

export function addSharedLoginOptionsToCommand(command: Command) {
  command
    .option("--subscription [subscriptionId]", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("--resource-group [resourceGroupName]", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroupName)
    .option("--tenant [tenantId]", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("--client-id [clientId]", "Azure client ID", DEFAULT_CONFIG.clientId)
    .option("--client-secret [clientSecret]", "Azure client secret", DEFAULT_CONFIG.clientSecret)
    .option("--app-name [appName]", "Azure Static Web App application name", DEFAULT_CONFIG.appName);
}

export default function registerCommand(program: Command) {
  const loginCommand = program
    .command("login")
    .usage("[options]")
    .description("login into Azure Static Web Apps")
    .option("--use-keychain <keychain>", "Enable credentials cache persistence", DEFAULT_CONFIG.useKeychain)
    .action(async (_options: SWACLIConfig, command: Command) => {
      const config = await configureOptions(undefined, command.optsWithGlobals(), command);

      try {
        const { credentialChain, subscriptionId, resourceGroupName, staticSiteName } = await login(config.options);

        if (credentialChain && subscriptionId && resourceGroupName && staticSiteName) {
          logger.log(chalk.green(`✔ Successfully setup project!`));
        } else {
          logger.log(chalk.red(`✘ Failed to setup project!`));
          logGiHubIssueMessageAndExit();
        }
      } catch (error) {
        logger.error(`Failed to setup project: ${(error as any).message}`);
        logGiHubIssueMessageAndExit();
      }
    })
    .addHelpText(
      "after",
      `
Examples:

  Interactive login
  swa login

  Interactive login without using the native keychain
  swa login --useKeychain false

  Log in into specific tenant
  swa login --tenant 00000000-0000-0000-0000-000000000000

  Log in using a specific subscription, resource group or an application
  swa login --subscription my-subscription \\
            --resource-group my-resource-group \\
            --app-name my-static-site

  Login using service principal
  swa login --tenant 00000000-0000-0000-0000-000000000000 \\
            --client-id 00000000-0000-0000-0000-000000000000 \\
            --client-secret 0000000000000000000000000000000000000000000000000000000000000000
    `
    );
  addSharedLoginOptionsToCommand(loginCommand);
}

export async function login(options: SWACLIConfig) {
  let credentialChain: TokenCredential | undefined = undefined;

  logger.log(`Checking Azure session...`);

  const { AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = swaCLIEnv();

  let tenantId: string | undefined = AZURE_TENANT_ID ?? options.tenantId;
  let clientId: string | undefined = AZURE_CLIENT_ID ?? options.clientId;
  let clientSecret: string | undefined = AZURE_CLIENT_SECRET ?? options.clientSecret;

  credentialChain = await authenticateWithAzureIdentity({ tenantId, clientId, clientSecret }, options.useKeychain);

  if (await credentialChain.getToken("profile")) {
    logger.log(chalk.green(`✔ Successfully logged into Azure Static Web Apps!`));
  }

  return await setupProjectDetails(options, credentialChain);
}

async function setupProjectDetails(options: SWACLIConfig, credentialChain: TokenCredential) {
  logger.log(``);
  logger.log(`Setting project...`);

  const { AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, SWA_CLI_APP_NAME, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET } = swaCLIEnv();

  let subscriptionId: string | undefined = AZURE_SUBSCRIPTION_ID ?? options.subscriptionId;
  let resourceGroupName: string | undefined = AZURE_RESOURCE_GROUP ?? options.resourceGroupName;
  let staticSiteName: string | undefined = SWA_CLI_APP_NAME ?? options.appName;
  let tenantId: string | undefined = AZURE_TENANT_ID ?? options.tenantId;
  let clientId: string | undefined = AZURE_CLIENT_ID ?? options.clientId;
  let clientSecret: string | undefined = AZURE_CLIENT_SECRET ?? options.clientSecret;

  // If the user has not specified a tenantId, we will prompt them to choose one
  if (!tenantId) {
    const tenants = await listTenants(credentialChain);
    if (tenants.length === 0) {
      throw new Error(
        `No Azure tenants found in your account.\n  Please read https://docs.microsoft.com/azure/cost-management-billing/manage/troubleshoot-sign-in-issue`
      );
    } else if (tenants.length === 1) {
      logger.silly(`Found 1 tenant: ${tenants[0].tenantId}`);
      tenantId = tenants[0].tenantId;
    } else {
      const tenant = await chooseTenant(tenants, options.tenantId);
      tenantId = tenant?.tenantId;
      // login again with the new tenant
      // TODO: can we silently authenticate the user with the new tenant?
      credentialChain = await authenticateWithAzureIdentity({ tenantId, clientId, clientSecret }, options.useKeychain);
    }
  }

  logger.silly(`Selected tenant: ${tenantId}`);

  // If the user has not specified a subscriptionId, we will prompt them to choose one
  if (!subscriptionId) {
    const subscriptions = await listSubscriptions(credentialChain);
    if (subscriptions.length === 0) {
      throw new Error(
        `No valid subscription found for tenant ${tenantId}.\n  Please read https://docs.microsoft.com/azure/cost-management-billing/manage/no-subscriptions-found`
      );
    } else if (subscriptions.length === 1) {
      logger.silly(`Found 1 subscription: ${subscriptions[0].subscriptionId}`);
      subscriptionId = subscriptions[0].subscriptionId;
    } else {
      const subscription = await chooseSubscription(subscriptions, subscriptionId);
      subscriptionId = subscription?.subscriptionId;
    }
  }

  logger.silly(`Selected subscription: ${subscriptionId}`);

  // If the user has not specified a resourceGroup, we will prompt them to choose one
  if (!resourceGroupName) {
    const resourceGroups = await listResourceGroups(credentialChain, subscriptionId);
    if (resourceGroups.length === 0) {
      // TODO: create a new resource group
      throw new Error(`No resource groups found in subscription ${subscriptionId}.`);
    } else if (resourceGroups.length === 1) {
      logger.silly(`Found 1 resource group: ${resourceGroups[0].name}`);
      resourceGroupName = resourceGroups[0].name;
    } else {
      const resourceGroup = await chooseResourceGroup(resourceGroups, resourceGroupName);
      resourceGroupName = resourceGroup?.name;
    }
  }

  logger.silly(`Selected resource group: ${resourceGroupName}`);

  // If the user has not specified a staticSite, we will prompt them to choose one
  if (resourceGroupName && !staticSiteName) {
    const staticSites = await listStaticSites(credentialChain, subscriptionId, resourceGroupName);
    if (staticSites.length === 0) {
      // TODO: create a new static site
      throw new Error(`No Static Web App found in resource group ${resourceGroupName}`);
    } else if (staticSites.length === 1) {
      logger.silly(`Found 1 Static Web App: ${staticSites[0].name}`);
      staticSiteName = staticSites[0].name;
    } else {
      const staticSite = await chooseStaticSite(staticSites, staticSiteName);
      staticSiteName = staticSite?.name;
    }
  }

  logger.silly(`Selected static site: ${staticSiteName}`);

  logger.silly(`Project information:`);
  logger.silly({ subscriptionId, resourceGroupName, staticSiteName });

  storeProjectDetailsInEnvFile(subscriptionId, resourceGroupName, staticSiteName, tenantId, clientId, clientSecret);

  return {
    credentialChain,
    subscriptionId,
    resourceGroupName,
    staticSiteName,
  };
}

async function storeProjectDetailsInEnvFile(
  subscriptionId: string | undefined,
  resourceGroupName: string | undefined,
  staticSiteName: string | undefined,
  tenantId: string | undefined,
  clientId: string | undefined,
  clientSecret: string | undefined
) {
  const envFile = path.join(process.cwd(), ".env");
  const envFileExists = existsSync(envFile);
  const envFileContent = envFileExists ? await readFile(envFile, "utf8") : "";
  const envFileLines = envFileContent.length ? envFileContent.split("\n") : [];
  const envFileLinesBeforeUpdate = envFileLines.length;

  let entry = `AZURE_SUBSCRIPTION_ID=${subscriptionId}`;
  if (subscriptionId && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  entry = `AZURE_RESOURCE_GROUP=${resourceGroupName}`;
  if (resourceGroupName && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  entry = `SWA_CLI_APP_NAME=${staticSiteName}`;
  if (staticSiteName && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  entry = `AZURE_TENANT_ID=${tenantId}`;
  if (tenantId && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  entry = `AZURE_CLIENT_ID=${clientId}`;
  if (clientId && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  entry = `AZURE_CLIENT_SECRET=${clientSecret}`;
  if (clientSecret && !envFileContent.includes(entry)) {
    envFileLines.push(entry);
  }

  const envFileContentWithProjectDetails = envFileLines.join("\n");
  await writeFile(envFile, envFileContentWithProjectDetails);

  if (envFileLinesBeforeUpdate < envFileLines.length) {
    logger.log(chalk.green(`✔ Successfully stored project details in .env file.`));
  }
}
