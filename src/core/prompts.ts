import { StaticSiteARMResource } from "@azure/arm-appservice";
import { GenericResourceExpanded } from "@azure/arm-resources";
import { Subscription, TenantIdDescription } from "@azure/arm-subscriptions";
import chalk from "chalk";
import prompts from "prompts";
import { dasherize, logger } from "./utils";

export async function promptOrUseDefault<T extends string = string>(
  disablePrompts: boolean,
  questions: prompts.PromptObject<T> | Array<prompts.PromptObject<T>>,
  options?: prompts.Options
): Promise<prompts.Answers<T>> {
  if (disablePrompts) {
    const response = {} as prompts.Answers<T>;
    questions = Array.isArray(questions) ? questions : [questions];
    for (const question of questions) {
      response[question.name as T] = question.initial;
    }
    return response;
  }

  return prompts(questions, { ...options, onCancel: cancelPrompt });
}

function cancelPrompt() {
  logger.log("Aborted, configuration not saved.");
  process.exit(-1);
}

export async function wouldYouLikeToCreateStaticSite(): Promise<boolean> {
  const response = await prompts({
    type: "confirm",
    name: "value",
    message: "Would you like to create a new Azure Static Web Apps project?",
  });

  return response.value;
}

export async function chooseProjectName(initial: string, maxLength: number): Promise<string> {
  const response = await promptOrUseDefault(false, {
    type: "text",
    name: "projectName",
    message: "Choose a project name:",
    initial,
    validate: (value: string) => {
      if (value.trim() === "") {
        return "Project name cannot be empty";
      } else if (value.trim().length > maxLength) {
        return "Project name cannot be longer than 60 characters";
      }

      return true;
    },
    format: (value: string) => dasherize(value.trim()),
  });
  return response.projectName;
}

export async function chooseResourceGroup(resourceGroups: GenericResourceExpanded[], initial?: string): Promise<GenericResourceExpanded | undefined> {
  const choices = resourceGroups.map((resourceGroup) => ({
    title: resourceGroup.name as string,
    value: resourceGroup,
  }));
  const onCancel = () => {
    logger.silly("Selection cancelled!");
    return false;
  };
  prompts.override({
    title: initial,
    value: initial,
  });
  const response = await prompts(
    {
      type: "select",
      name: "ResourceGroup",
      message: "Choose your resource group",
      initial,
      choices,
    },
    { onCancel }
  );
  return response.ResourceGroup as GenericResourceExpanded;
}

export async function chooseTenant(tenants: TenantIdDescription[], initial?: string): Promise<TenantIdDescription | undefined> {
  const choices = tenants.map((tenant) => ({
    title: tenant.tenantId as string,
    value: tenant,
  }));
  const onCancel = () => {
    logger.silly("Selection cancelled!");
    return false;
  };
  prompts.override({
    title: initial,
    value: initial,
  });
  const response = await prompts(
    {
      type: "select",
      name: "Tenant",
      message: "Choose your tenant",
      initial,
      choices,
    },
    { onCancel }
  );
  return response.Tenant as TenantIdDescription;
}

export async function chooseSubscription(subscriptions: Subscription[], initial?: string): Promise<Subscription | undefined> {
  const choices = subscriptions.map((subscription) => ({
    title: subscription.displayName as string,
    value: subscription,
  }));
  const onCancel = () => {
    logger.silly("Selection cancelled!");
    return false;
  };
  prompts.override({
    title: initial,
    value: initial,
  });
  const response = await prompts(
    {
      type: "select",
      name: "Subscription",
      message: "Choose your subscription",
      choices,
    },
    { onCancel }
  );
  return response.Subscription as Subscription;
}

export async function chooseStaticSite(staticSites: StaticSiteARMResource[], initial?: string): Promise<StaticSiteARMResource | "NEW" | undefined> {
  let choices: Array<{
    title: string;
    value: StaticSiteARMResource | "NEW";
  }> = staticSites.map((staticSite) => ({
    title: staticSite.name as string,
    value: staticSite,
  }));

  choices = [
    {
      title: chalk.green(">> Create a new application"),
      value: "NEW",
    },
    ...choices,
  ];

  const onCancel = () => {
    logger.silly("Selection cancelled!");
    return false;
  };
  prompts.override({
    title: initial,
    value: initial,
  });
  const response = await prompts(
    {
      type: "select",
      name: "staticSite",
      message: "Choose your Static Web App",
      initial,
      choices,
    },
    { onCancel }
  );
  return response.staticSite as StaticSiteARMResource | "NEW";
}

export async function confirmChooseRandomPort(initial?: string): Promise<boolean> {
  const onCancel = () => {
    logger.silly("Selection cancelled!");
    return false;
  };
  prompts.override({
    title: initial,
    value: initial,
  });
  const response = await prompts(
    {
      type: "confirm",
      name: "confirm",
      message: "Would you like to start the emulator on a different port?",
    },
    { onCancel }
  );
  return response.confirm as boolean;
}
