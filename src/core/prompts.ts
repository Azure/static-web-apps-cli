import { StaticSiteARMResource } from "@azure/arm-appservice";
import { GenericResourceExpanded } from "@azure/arm-resources";
import { Subscription, TenantIdDescription } from "@azure/arm-subscriptions";
import prompts from "prompts";
import { logger } from "./utils";

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

export async function chooseStaticSite(staticSites: StaticSiteARMResource[], initial?: string): Promise<StaticSiteARMResource | undefined> {
  const choices = staticSites.map((staticSite) => ({
    title: staticSite.name as string,
    value: staticSite,
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
      name: "staticSite",
      message: "Choose your Static Web App",
      initial,
      choices,
    },
    { onCancel }
  );
  return response.staticSite as StaticSiteARMResource;
}
