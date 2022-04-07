import { AccessToken, TokenCredential } from "@azure/core-auth";
import { Environment } from "@azure/ms-rest-azure-env";
import { Constants as MSRestConstants, WebResource } from "@azure/ms-rest-js";
import { AccountInfo, AuthenticationResult, AzureCloudInstance, PublicClientApplication } from "@azure/msal-node";
import { getDefaultMsalScopes } from "./msal-scopes";

export class PublicClientCredential implements TokenCredential {
  private publicClientApp: PublicClientApplication;
  private accountInfo: AccountInfo;

  constructor(publicClientApp: PublicClientApplication, accountInfo: AccountInfo) {
    this.publicClientApp = publicClientApp;
    this.accountInfo = accountInfo;
  }

  public async getToken(scopes?: string | string[]): Promise<AccessToken | null> {
    if (scopes) {
      scopes = Array.isArray(scopes) ? scopes : [scopes];
    } else {
      scopes = [];
    }

    const environment = Environment.AzureCloud;

    if (scopes.length === 1 && scopes[0] === "https://management.azure.com/.default") {
      // The Azure Functions & App Service APIs only accept the legacy scope (which is the default scope we use)
      scopes = getDefaultMsalScopes(environment);
    }

    const authResult: AuthenticationResult | null = await this.publicClientApp.acquireTokenSilent({
      scopes,
      account: this.accountInfo,
      azureCloudOptions: {
        azureCloudInstance: AzureCloudInstance.AzurePublic,
        tenant: "common",
      },
    });

    if (authResult && authResult.expiresOn) {
      return {
        token: authResult.accessToken,
        expiresOnTimestamp: authResult.expiresOn.getTime(),
      };
    }

    return null;
  }

  public async signRequest(webResource: WebResource): Promise<WebResource | undefined> {
    const tokenResponse: AccessToken | null = await this.getToken(getDefaultMsalScopes(Environment.AzureCloud));
    if (tokenResponse) {
      webResource.headers.set(
        MSRestConstants.HeaderConstants.AUTHORIZATION,
        `${MSRestConstants.HeaderConstants.AUTHORIZATION_SCHEME} ${tokenResponse.token}`
      );
      return webResource;
    }
    return;
  }
}
