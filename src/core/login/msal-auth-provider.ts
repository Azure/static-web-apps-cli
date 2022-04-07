import { Environment } from "@azure/ms-rest-azure-env";
import { AccountInfo, DeviceCodeResponse } from "@azure/msal-common";
import { AuthenticationResult, AzureCloudInstance, Configuration, LogLevel, PublicClientApplication, TokenCache } from "@azure/msal-node";
import { logger } from "../utils";
import { AbstractCredentials, AuthProviderBase } from "./auth-provider-base";
import { cachePlugin } from "./cache-plugin";
import { getDefaultMsalScopes } from "./msal-scopes";
import { authTimeoutSeconds } from "./server";

export const clientId: string = "aebc6443-996d-45c2-90f0-388ff96faa56";

export class MsalAuthProvider extends AuthProviderBase<AuthenticationResult> {
  private publicClientApp: PublicClientApplication;

  constructor(enableVerboseLogs: boolean) {
    super();
    const msalConfiguration: Configuration = {
      auth: { clientId },
      cache: { cachePlugin },
      system: {
        loggerOptions: {
          loggerCallback: (_level: LogLevel, message: string, _containsPii: boolean) => {
            logger.silly(message);
          },
          piiLoggingEnabled: false,
          logLevel: enableVerboseLogs ? LogLevel.Verbose : LogLevel.Error,
        },
      },
    };
    this.publicClientApp = new PublicClientApplication(msalConfiguration);
  }

  public async loginWithAuthCode(
    code: string,
    redirectUrl: string,
    _clientId: string,
    environment: Environment,
    tenantId: string
  ): Promise<AuthenticationResult> {
    const authResult: AuthenticationResult | null = await this.publicClientApp.acquireTokenByCode({
      scopes: getDefaultMsalScopes(environment),
      code,
      redirectUri: redirectUrl,
      azureCloudOptions: {
        azureCloudInstance: AzureCloudInstance.AzurePublic,
        tenant: tenantId,
      },
    });

    if (!authResult) {
      throw new Error(`MSAL authentication code login failed.`);
    }

    return authResult;
  }

  public async loginWithDeviceCode(environment: Environment, tenantId: string | undefined): Promise<AuthenticationResult> {
    const authResultTask: Promise<AuthenticationResult | null> = this.publicClientApp
      .acquireTokenByDeviceCode({
        scopes: getDefaultMsalScopes(environment),
        deviceCodeCallback: (response: DeviceCodeResponse) =>
          this.showDeviceCodeMessage(response.message, response.userCode, response.verificationUri),
        azureCloudOptions: {
          azureCloudInstance: AzureCloudInstance.AzurePublic,
          tenant: tenantId,
        },
        timeout: authTimeoutSeconds,
      })
      .then(async (result) => {
        await this.clearTokenCache();
        return result;
      });

    let authResult: AuthenticationResult | null;
    try {
      authResult = await authResultTask;
    } catch (error) {
      throw error;
    }

    if (!authResult) {
      throw new Error("MSAL device code login failed.");
    }

    return authResult;
  }

  public async loginSilent(environment: Environment, tenantId: string): Promise<AuthenticationResult> {
    const msalTokenCache: TokenCache = this.publicClientApp.getTokenCache();
    const accountInfo: AccountInfo[] = await msalTokenCache.getAllAccounts();
    let authResult: AuthenticationResult | null;

    if (accountInfo.length === 1) {
      authResult = await this.publicClientApp.acquireTokenSilent({
        scopes: getDefaultMsalScopes(environment),
        account: accountInfo[0],
        azureCloudOptions: {
          azureCloudInstance: AzureCloudInstance.AzurePublic,
          tenant: tenantId,
        },
      });

      if (!authResult) {
        throw new Error("Silent login failed.");
      }

      return authResult;
    } else if (accountInfo.length) {
      throw new Error("Expected a single account when reading cache but multiple were found.");
    } else {
      throw new Error("No account was found when reading cache.");
    }
  }

  public getCredentials(): AbstractCredentials {
    throw new Error(
      'MSAL does not support this credentials type. As a workaround, revert the "azure.authenticationLibrary" setting to "ADAL" and consider filing an issue on the extension author.'
    );
  }

  public async clearTokenCache(): Promise<void> {
    const tokenCache: TokenCache = this.publicClientApp.getTokenCache();

    for (const account of await tokenCache.getAllAccounts()) {
      await tokenCache.removeAccount(account);
    }
  }
}
