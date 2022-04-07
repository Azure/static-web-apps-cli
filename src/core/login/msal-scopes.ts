import { Environment } from "@azure/ms-rest-azure-env";

export function getDefaultMsalScopes(environment: Environment): string[] {
  return [createMsalScope(environment.managementEndpointUrl)];
}

function createMsalScope(authority: string, scope: string = ".default"): string {
  return authority.endsWith("/") ? `${authority}${scope}` : `${authority}/${scope}`;
}
