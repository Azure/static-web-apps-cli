import { Environment } from "@azure/ms-rest-azure-env";
import { randomBytes } from "crypto";
import { ServerResponse } from "http";
import { DeviceTokenCredentials } from "ms-rest-azure";
import open from "open";
import { logger } from "../utils";
import { CodeResult, createServer, RedirectResult, startServer } from "./server";

export type AbstractCredentials = DeviceTokenCredentials;

async function redirectTimeout(): Promise<void> {
  logger.warn("Browser did not connect to local server within 10 seconds. Trying the alternate sign in using a device code instead...");
}

export abstract class AuthProviderBase<TLoginResult> {
  public abstract loginWithAuthCode(
    code: string,
    redirectUrl: string,
    clientId: string | undefined,
    environment: Environment,
    tenantId: string
  ): Promise<TLoginResult>;
  public abstract loginWithDeviceCode(environment: Environment, tenantId: string): Promise<TLoginResult>;
  public abstract loginSilent(environment: Environment, tenantId: string): Promise<TLoginResult>;
  public abstract getCredentials(environment: string, userId: string, tenantId: string): AbstractCredentials;
  public abstract clearTokenCache(): Promise<void>;

  public async login(clientId: string | undefined, environment: Environment, tenantId: string | undefined): Promise<TLoginResult> {
    if (!clientId) {
      throw new Error("Client ID is required");
    }

    if (!tenantId) {
      throw new Error("Tenant ID is required");
    }

    const nonce: string = randomBytes(16).toString("base64");
    const { server, redirectPromise, codePromise } = createServer(nonce);

    // cancellationToken.onCancellationRequested(() => {
    //   server.close(error => {
    //     if (error) {
    //       logger.error(error);
    //     }
    //   });

    //   clearTimeout(codeTimer);

    //   logger.warn('Authentication process cancelled.')
    // });

    try {
      const port: number = await startServer(server);
      await open(`http://localhost:${port}/signin?nonce=${encodeURIComponent(nonce)}`);

      const redirectTimer = setTimeout(
        () =>
          redirectTimeout().catch((error) => {
            logger.error(error);
          }),
        10 * 1000
      );

      const redirectResult: RedirectResult = await redirectPromise;

      if ("err" in redirectResult) {
        const { err, res } = redirectResult;
        res.writeHead(302, { Location: `/?error=${encodeURIComponent((err && err.message) || "Unknown error")}` });
        res.end();
        throw err;
      }

      clearTimeout(redirectTimer);

      const host: string = redirectResult.req.headers.host || "";
      const updatedPortStr: string = (/^[^:]+:(\d+)$/.exec(Array.isArray(host) ? host[0] : host) || [])[1];
      const updatedPort: number = updatedPortStr ? parseInt(updatedPortStr, 10) : port;
      const state: string = encodeURIComponent(`http://127.0.0.1:${updatedPort}/callback?nonce=${encodeURIComponent(nonce)}`);
      const redirectUrl: string = `https://vscode.dev/redirect`;
      const signInUrl: string = `${
        environment.activeDirectoryEndpointUrl
      }${`${tenantId}/`}oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(
        redirectUrl
      )}&state=${state}`;

      redirectResult.res.writeHead(302, { Location: signInUrl });
      redirectResult.res.end();

      const codeResult: CodeResult = await codePromise;
      const serverResponse: ServerResponse = codeResult.res;
      try {
        if ("err" in codeResult) {
          throw codeResult.err;
        }

        try {
          return await this.loginWithAuthCode(codeResult.code, redirectUrl, clientId, environment, tenantId);
        } finally {
          serverResponse.writeHead(302, { Location: "/" });
          serverResponse.end();
        }
      } catch (err) {
        serverResponse.writeHead(302, { Location: `/?error=${encodeURIComponent((err as any).message || "Unknown error")}` });
        serverResponse.end();
        throw err;
      }
    } finally {
      setTimeout(() => {
        server.close((error) => {
          if (error) {
            logger.error(error);
          }
        });
      }, 5000);
    }
  }

  protected async showDeviceCodeMessage(message: string, userCode: string, verificationUrl: string): Promise<void> {
    logger.log(message);
    logger.log(`Copy user code: ${userCode}`);
    await open(verificationUrl);
  }
}
