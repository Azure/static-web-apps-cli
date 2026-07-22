import * as client from "openid-client";

/**
 * Normalize an `openIdIssuer` URL so that `openid-client`'s discovery
 * (`<issuer>/.well-known/openid-configuration`) resolves in both local CLI
 * and deployed SWA environments.
 *
 * Background: the Microsoft identity platform v2.0 canonical issuer is
 * `https://login.microsoftonline.com/<tenant>/v2.0`. A legacy/alias form,
 * `https://login.microsoftonline.com/<tenant>/oauth2/v2.0`, is accepted by
 * the deployed SWA runtime but causes the CLI's OIDC discovery to fail
 * (ERR_TOO_MANY_REDIRECTS or 404). We strip the trailing `/oauth2` segment
 * so that users can keep a single `staticwebapp.config.json` that works
 * both locally and when deployed.
 *
 * The same normalization applies to Entra External ID (`*.ciamlogin.com`)
 * and Entra custom URL domains — any `.../<tenant>/oauth2/v2.0` suffix is
 * rewritten to `.../<tenant>/v2.0`.
 *
 * See: https://github.com/Azure/static-web-apps-cli/issues/947
 */
export function normalizeOpenIdIssuer(issuer: string): string {
  if (!issuer) {
    return issuer;
  }
  // Rewrite `/oauth2/v2.0` (with optional trailing slash) to `/v2.0` while
  // preserving any trailing slash the user provided.
  return issuer.replace(/\/oauth2\/v2\.0(\/?)$/, "/v2.0$1");
}

export class OpenIdHelper {
  private issuerUrl: URL;
  private clientId: string;

  constructor(issuerUrl: string, clientId: string) {
    if (!issuerUrl || issuerUrl.trim() === "") {
      throw new Error("Issuer URL is required");
    }
    if (!clientId || clientId.trim() === "") {
      throw new Error("Client ID is required");
    }
    this.issuerUrl = new URL(normalizeOpenIdIssuer(issuerUrl));
    this.clientId = clientId;
  }

  /**
   * Discover issuer metadata from the OpenID Connect provider
   */
  async discoverIssuer() {
    return await client.discovery(this.issuerUrl, this.clientId);
  }

  /**
   * Retrieve the authorization endpoint from the issuer
   */
  async getAuthorizationEndpoint(): Promise<string> {
    const issuer = await this.discoverIssuer();
    if (!issuer.serverMetadata().authorization_endpoint) {
      throw new Error("Authorization endpoint not found in issuer metadata");
    }
    return issuer.serverMetadata().authorization_endpoint!;
  }
}
