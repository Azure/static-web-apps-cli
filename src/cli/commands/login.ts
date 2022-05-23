import { TokenCredential } from "@azure/identity";
import chalk from "chalk";
import { Command } from "commander";
import dotenv from "dotenv";
import { existsSync, promises as fsPromises } from "fs";
import path from "path";
import { DEFAULT_CONFIG } from "../../config";
import { configureOptions, logger, logGiHubIssueMessageAndExit } from "../../core";
import { authenticateWithAzureIdentity, listSubscriptions, listTenants } from "../../core/account";
import { ENV_FILENAME } from "../../core/constants";
import { updateGitIgnore } from "../../core/git";
import { chooseSubscription, chooseTenant } from "../../core/prompts";
const { readFile, writeFile } = fsPromises;

export function addSharedLoginOptionsToCommand(command: Command) {
  command
    .option("-S, --subscription-id <subscriptionId>", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("-R, --resource-group <resourceGroupName>", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroupName)
    .option("-T, --tenant-id <tenantId>", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("-C, --client-id <clientId>", "Azure client ID", DEFAULT_CONFIG.clientId)
    .option("-CS, --client-secret <clientSecret>", "Azure client secret", DEFAULT_CONFIG.clientSecret)
    .option("-n, --app-name <appName>", "Azure Static Web App application name", DEFAULT_CONFIG.appName)
    .option("-cc, --clear-credentials", "clear persisted credentials before login", DEFAULT_CONFIG.clearCredentials)

    .option("-u, --use-keychain", "enable using the operating system native keychain for persistent credentials", DEFAULT_CONFIG.useKeychain)
    // Note: Commander does not automatically recognize the --no-* option, so we have to explicitly use --no-use-keychain- instead
    .option("-nu, --no-use-keychain", "disable using the operating system native keychain", !DEFAULT_CONFIG.useKeychain);
}

export default function registerCommand(program: Command) {
  const loginCommand = program
    .command("login")
    .usage("[options]")
    .description("login into Azure")
    .action(async (_options: SWACLIConfig, command: Command) => {
      const options = await configureOptions(undefined, command.optsWithGlobals(), command, "login");

      try {
        const { credentialChain, subscriptionId } = await login(options);

        if (credentialChain && subscriptionId) {
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

  Interactive login without persisting credentials
  swa login --no-use-keychain

  Log in into specific tenant
  swa login --tenant-id 00000000-0000-0000-0000-000000000000

  Log in using a specific subscription, resource group or an application
  swa login --subscription-id my-subscription \\
            --resource-group my-resource-group \\
            --app-name my-static-site

  Login using service principal
  swa login --tenant-id 00000000-0000-0000-0000-000000000000 \\
            --client-id 00000000-0000-0000-0000-000000000000 \\
            --client-secret 0000000000000000000000000000000000000000000000000000000000000000
    `
    );
  addSharedLoginOptionsToCommand(loginCommand);
}

export async function login(options: SWACLIConfig): Promise<any> {
  let credentialChain: TokenCredential | undefined = undefined;

  logger.log(`Checking Azure session...`);

  let tenantId: string | undefined = options.tenantId;
  let clientId: string | undefined = options.clientId;
  let clientSecret: string | undefined = options.clientSecret;

  credentialChain = await authenticateWithAzureIdentity({ tenantId, clientId, clientSecret }, options.useKeychain, options.clearCredentials);

  if (await credentialChain.getToken("profile")) {
    logger.log(chalk.green(`✔ Successfully logged into Azure!`));
  }

  return await setupProjectCredentials(options, credentialChain);
}

async function setupProjectCredentials(options: SWACLIConfig, credentialChain: TokenCredential) {
  let { subscriptionId, tenantId, clientId, clientSecret } = options;

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
      credentialChain = await authenticateWithAzureIdentity({ tenantId, clientId, clientSecret }, options.useKeychain, true);

      if (await credentialChain.getToken("profile")) {
        logger.log(chalk.green(`✔ Successfully logged into Azure tenant: ${tenantId}`));
      }
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

  logger.silly(`Project credentials:`);
  logger.silly({ subscriptionId, tenantId, clientId, clientSecret });

  await storeProjectCredentialsInEnvFile(subscriptionId, tenantId, clientId, clientSecret);

  return {
    credentialChain,
    subscriptionId: subscriptionId as string,
  };
}

async function storeProjectCredentialsInEnvFile(
  subscriptionId: string | undefined,
  tenantId: string | undefined,
  clientId: string | undefined,
  clientSecret: string | undefined
) {
  const envFile = path.join(process.cwd(), ENV_FILENAME);
  const envFileExists = existsSync(envFile);
  const envFileContent = envFileExists ? await readFile(envFile, "utf8") : "";
  const buf = Buffer.from(envFileContent);

  // in case the .env file format changes in the future, we can use the following to parse the file
  const config = dotenv.parse(buf);
  const oldEnvFileLines = Object.keys(config).map((key) => `${key}=${config[key]}`);
  const newEnvFileLines = [];

  let entry = `AZURE_SUBSCRIPTION_ID=${subscriptionId}`;
  if (subscriptionId && !envFileContent.includes(entry)) {
    newEnvFileLines.push(entry);
  }

  entry = `AZURE_TENANT_ID=${tenantId}`;
  if (tenantId && !envFileContent.includes(entry)) {
    newEnvFileLines.push(entry);
  }

  entry = `AZURE_CLIENT_ID=${clientId}`;
  if (clientId && !envFileContent.includes(entry)) {
    newEnvFileLines.push(entry);
  }

  entry = `AZURE_CLIENT_SECRET=${clientSecret}`;
  if (clientSecret && !envFileContent.includes(entry)) {
    newEnvFileLines.push(entry);
  }

  // write file if we have at least one new env line
  if (newEnvFileLines.length > 0) {
    const envFileContentWithProjectDetails = [...oldEnvFileLines, ...newEnvFileLines].join("\n");
    await writeFile(envFile, envFileContentWithProjectDetails);

    logger.log(chalk.green(`✔ Saved project credentials in ${ENV_FILENAME} file.`));

    await updateGitIgnore(ENV_FILENAME);
  }
}
