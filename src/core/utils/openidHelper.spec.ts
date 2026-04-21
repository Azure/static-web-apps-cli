import { describe, it, expect } from "vitest";
import { normalizeOpenIdIssuer } from "./openidHelper.js";

describe("normalizeOpenIdIssuer", () => {
  describe("Microsoft identity platform (login.microsoftonline.com)", () => {
    it("strips legacy /oauth2 segment for v2.0 issuer so discovery resolves (fixes ERR_TOO_MANY_REDIRECTS)", () => {
      // Deployed SWA runtime accepts `.../<tenant>/v2.0` but the local CLI's
      // `openid-client.discovery()` requires the canonical issuer (no /oauth2).
      // Users must be able to use the same `staticwebapp.config.json` in both
      // environments, so the CLI normalizes the legacy form before discovery.
      const input = "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/oauth2/v2.0";
      const expected = "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe(expected);
    });

    it("preserves the canonical v2.0 issuer unchanged", () => {
      const input = "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });

    it("preserves the issuer regardless of a trailing slash", () => {
      const input = "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0/";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });

    it("handles common-tenant (multi-tenant) endpoint with /oauth2/ prefix", () => {
      const input = "https://login.microsoftonline.com/common/oauth2/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe("https://login.microsoftonline.com/common/v2.0");
    });

    it("handles organizations-tenant endpoint with /oauth2/ prefix", () => {
      const input = "https://login.microsoftonline.com/organizations/oauth2/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe("https://login.microsoftonline.com/organizations/v2.0");
    });
  });

  describe("Entra External ID (ciamlogin.com)", () => {
    it("preserves ciamlogin.com issuer unchanged (already canonical)", () => {
      const input = "https://contoso.ciamlogin.com/contoso.onmicrosoft.com/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });

    it("strips legacy /oauth2 segment from ciamlogin.com issuer when present", () => {
      const input = "https://contoso.ciamlogin.com/contoso.onmicrosoft.com/oauth2/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe("https://contoso.ciamlogin.com/contoso.onmicrosoft.com/v2.0");
    });
  });

  describe("Entra custom URL domains", () => {
    it("preserves custom-domain issuer unchanged", () => {
      const input = "https://login.contoso.com/00000000-0000-0000-0000-000000000000/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });

    it("strips legacy /oauth2 segment from custom-domain issuer when present", () => {
      const input = "https://login.contoso.com/00000000-0000-0000-0000-000000000000/oauth2/v2.0";
      expect(normalizeOpenIdIssuer(input)).toBe("https://login.contoso.com/00000000-0000-0000-0000-000000000000/v2.0");
    });
  });

  describe("edge cases", () => {
    it("returns an empty string unchanged (upstream validates separately)", () => {
      expect(normalizeOpenIdIssuer("")).toBe("");
    });

    it("returns a non-matching URL unchanged", () => {
      const input = "https://example.com/some/other/issuer";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });

    it("does not strip /oauth2 when it is not followed by /v2.0", () => {
      // Defensive: we only target the known Microsoft legacy alias form.
      const input = "https://example.com/tenant/oauth2/other";
      expect(normalizeOpenIdIssuer(input)).toBe(input);
    });
  });
});
