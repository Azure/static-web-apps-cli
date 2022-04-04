import { StaticSiteARMResource } from "@azure/arm-appservice";
import { GenericResourceExpanded } from "@azure/arm-resources";
import { TenantIdDescription, Subscription } from "@azure/arm-subscriptions";
import prompts from "prompts";

export async function chooseResourceGroup(resourceGroups: GenericResourceExpanded[], initial?: string): Promise<GenericResourceExpanded> {
  const choices = resourceGroups.map((resourceGroup) => ({
    title: resourceGroup.name as string,
    value: resourceGroup,
  }));
  const response = await prompts({
    type: "select",
    name: "ResourceGroup",
    message: "Choose your resource group",
    initial,
    choices,
  });
  return response.ResourceGroup as GenericResourceExpanded;
}

export async function chooseTenant(tenants: TenantIdDescription[], initial?: string): Promise<TenantIdDescription> {
  const choices = tenants.map((tenant) => ({
    title: tenant.tenantId as string,
    value: tenant,
  }));
  const response = await prompts({
    type: "select",
    name: "Tenant",
    message: "Choose your tenant",
    initial,
    choices,
  });
  return response.Tenant as TenantIdDescription;
}

export async function chooseSubscription(subscriptions: Subscription[], initial?: string): Promise<Subscription> {
  const choices = subscriptions.map((subscription) => ({
    title: subscription.displayName as string,
    value: subscription,
  }));
  const response = await prompts({
    type: "select",
    name: "Subscription",
    message: "Choose your subscription",
    initial,
    choices,
  });
  return response.Subscription as Subscription;
}

export async function chooseStaticSite(staticSites: StaticSiteARMResource[], initial?: string): Promise<StaticSiteARMResource> {
  const choices = staticSites.map((staticSite) => ({
    title: staticSite.name as string,
    value: staticSite,
  }));
  const response = await prompts({
    type: "select",
    name: "staticSite",
    message: "Choose your Static Web App",
    initial,
    choices,
  });
  return response.staticSite as StaticSiteARMResource;
}
