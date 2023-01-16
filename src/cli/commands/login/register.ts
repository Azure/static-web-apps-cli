import { Command } from "commander";
import { DEFAULT_CONFIG } from "../../../config";
import { configureOptions } from "../../../core";
import { loginCommand as login } from "./login";

export function addSharedLoginOptionsToCommand(command: Command) {
  command
    .option("-S, --subscription-id <subscriptionId>", "Azure subscription ID used by this project", DEFAULT_CONFIG.subscriptionId)
    .option("-R, --resource-group <resourceGroup>", "Azure resource group used by this project", DEFAULT_CONFIG.resourceGroup)
    .option("-T, --tenant-id <tenantId>", "Azure tenant ID", DEFAULT_CONFIG.tenantId)
    .option("-C, --client-id <clientId>", "Azure client ID", DEFAULT_CONFIG.clientId)
    .option("-CS, --client-secret <clientSecret>", "Azure client secret", DEFAULT_CONFIG.clientSecret)
    .option("-n, --app-name <appName>", "Azure Static Web App application name", DEFAULT_CONFIG.appName)
    .option("-CC, --clear-credentials", "clear persisted credentials before login", DEFAULT_CONFIG.clearCredentials)

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
      await login(options);
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
