import { StaticSiteARMResource } from "@azure/arm-appservice";
import { Subscription, TenantIdDescription } from "@azure/arm-subscriptions";
import chalk from "chalk";
import prompts, { Answers, PromptObject } from "prompts";
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

  return prompts(questions, { ...options, onCancel: onCancelPrompt });
}

function onCancelPrompt() {
  logger.error("Operation canceled. Exit.\n", true);
}

export async function wouldYouLikeToCreateStaticSite(): Promise<boolean> {
  const response = await promptOrUseDefault(false, {
    type: "confirm",
    name: "value",
    message: "Would you like to create a new Azure Static Web Apps project?",
    initial: true,
  });

  return response.value;
}

export async function wouldYouLikeToOverrideStaticSite(appNameToOverride: string): Promise<boolean> {
  const response = await promptOrUseDefault(false, {
    type: "text",
    name: "value",
    message: `Project already exist! Enter project name to override:`,
    warn: `Previous deployment in project "${appNameToOverride}" will be overwritten.`,
    initial: "Press CTRL+L to cancel and exit",
    validate: (value: string) => {
      if (value === appNameToOverride) {
        return true;
      }
      return `Confirmation doesn't match project name!`;
    },
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
        return `Project name cannot be longer than ${maxLength} characters!`;
      }

      return true;
    },
    format: (value: string) => dasherize(value.trim()),
  });
  return response.projectName;
}

export async function chooseTenant(tenants: TenantIdDescription[], initial?: string): Promise<TenantIdDescription | undefined> {
  const choices = tenants.map((tenant) => ({
    title: tenant.tenantId as string,
    value: tenant,
  }));
  const response = await promptOrUseDefault(false, {
    type: "select",
    name: "Tenant",
    message: "Choose your tenant",
    initial,
    choices,
  });
  return response.Tenant as TenantIdDescription;
}

export async function chooseSubscription(subscriptions: Subscription[], initial?: string): Promise<Subscription | undefined> {
  const choices = subscriptions.map((subscription) => ({
    title: subscription.displayName as string,
    value: subscription,
  }));
  const response = await promptOrUseDefault(false, {
    type: "select",
    name: "Subscription",
    message: "Choose your subscription",
    choices,
    initial,
  });
  return response.Subscription as Subscription;
}

export async function chooseStaticSite(staticSites: StaticSiteARMResource[], initial?: string): Promise<string | "NEW" | undefined> {
  logger.silly(`choose static site with initial: ${initial}`);

  let choices: Array<{
    title: string;
    value: string | "NEW";
  }> = staticSites.map((staticSite) => ({
    // format as "resource-group/app-name"
    title: `${chalk.gray(staticSite.id?.split("/")[4] + "/")}${staticSite.name}`,
    value: staticSite.name as string,
  }));

  // allow users to create a new static site
  choices = [
    {
      title: chalk.green(">> Create a new application"),
      value: "NEW",
    },
    ...choices,
  ];

  const response = await promptOrUseDefault(false, {
    type: "select",
    name: "staticSite",
    message: "Choose your Static Web App",
    initial: (_a: any, _b: Answers<"staticSite">, _c: PromptObject<string>) => {
      // Note: in case of a select prompt, initial is always an index
      const index = choices.findIndex((choice) => choice.value === initial);
      return index === -1 ? 0 : index;
    },
    choices,
  });
  return response.staticSite as string | "NEW";
}

export async function confirmChooseRandomPort(initial?: boolean): Promise<boolean> {
  const response = await promptOrUseDefault(false, {
    type: "confirm",
    name: "confirm",
    message: "Would you like to start the emulator on a different port?",
    initial,
  });
  return response.confirm as boolean;
}
