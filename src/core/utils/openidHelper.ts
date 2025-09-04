import * as client from "openid-client";

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
    this.issuerUrl = new URL(issuerUrl);
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
