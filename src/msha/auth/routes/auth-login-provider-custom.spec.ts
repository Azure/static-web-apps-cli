// Tests that `/.auth/login/aad` in local dev — when the real AAD env vars are
// NOT set — falls back to the SWA local auth emulator instead of returning
// `AAD_CLIENT_ID not found in env for 'aad' provider`.
//
// Regression coverage for https://github.com/Azure/static-web-apps-cli/issues/947
// which was broken in 2.0.3 by PR #905.

vi.mock("../../../core/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../core/constants.js")>();
  return {
    ...actual,
    SWA_CLI_APP_PROTOCOL: "http",
  };
});

// Mock the auth-login-provider module so we can assert emulator delegation
// without depending on the real HTML fixture file.
vi.mock("./auth-login-provider.js", () => {
  return {
    default: vi.fn(async (context: Context, _request: unknown) => {
      context.res = {
        status: 200,
        headers: { "Content-Type": "text/html" },
        body: "<emulator></emulator>",
      };
    }),
  };
});

import { IncomingMessage } from "node:http";
import authLoginProviderEmulator from "./auth-login-provider.js";
import httpTrigger from "./auth-login-provider-custom.js";

describe("auth-login-provider-custom — AAD local emulator fallback (issue #947)", () => {
  let context: Context;
  let req: IncomingMessage;

  const baseCustomAuth = {
    identityProviders: {
      azureActiveDirectory: {
        registration: {
          openIdIssuer: "https://login.microsoftonline.com/tenant-id/v2.0",
          clientIdSettingName: "AAD_CLIENT_ID",
          clientSecretSettingName: "AAD_CLIENT_SECRET",
        },
      },
    },
  };

  beforeEach(() => {
    context = { bindingData: { provider: "aad" } } as unknown as Context;
    req = {
      url: "/.auth/login/aad",
      headers: { host: "localhost:4280" },
    } as IncomingMessage;
    delete process.env.AAD_CLIENT_ID;
    delete process.env.AAD_CLIENT_SECRET;
    vi.mocked(authLoginProviderEmulator).mockClear();
  });

  it("falls back to the local auth emulator when AAD clientId env var is unset", async () => {
    // Only secret is set — clientId is missing.
    process.env.AAD_CLIENT_SECRET = "test-secret";

    await httpTrigger(context, req, baseCustomAuth);

    expect(authLoginProviderEmulator).toHaveBeenCalledOnce();
    // The custom handler should NOT have returned the 400 error from 2.0.3+.
    expect(context.res.status).not.toBe(400);
  });

  it("falls back to the local auth emulator when AAD clientSecret env var is unset", async () => {
    // Only clientId is set — secret is missing.
    process.env.AAD_CLIENT_ID = "test-client-id";

    await httpTrigger(context, req, baseCustomAuth);

    expect(authLoginProviderEmulator).toHaveBeenCalledOnce();
    expect(context.res.status).not.toBe(400);
  });

  it("falls back when both AAD env vars are unset (common local-dev case)", async () => {
    await httpTrigger(context, req, baseCustomAuth);

    expect(authLoginProviderEmulator).toHaveBeenCalledOnce();
    // Before the fix, this would have been: 400 with body
    // "AAD_CLIENT_ID not found in env for 'aad' provider".
    expect(context.res.status).not.toBe(400);
  });

  it("does NOT fall back when both AAD env vars are set (real-auth path)", async () => {
    process.env.AAD_CLIENT_ID = "test-client-id";
    process.env.AAD_CLIENT_SECRET = "test-secret";

    // We don't care about discovery here — either a 302 to the issuer or a
    // discovery error is fine; we only assert we did NOT delegate to the
    // emulator.
    try {
      await httpTrigger(context, req, baseCustomAuth);
    } catch {
      // discovery may fail against the fake tenant — that's OK for this assertion.
    }

    expect(authLoginProviderEmulator).not.toHaveBeenCalled();
  });

  it("does NOT fall back when the config itself is missing a required field (hard error)", async () => {
    // Missing `clientIdSettingName` entirely — this is a user config bug, not
    // a local-dev signal, so the handler should surface a 400 as before.
    const brokenAuth = {
      identityProviders: {
        azureActiveDirectory: {
          registration: {
            openIdIssuer: "https://login.microsoftonline.com/tenant-id/v2.0",
            clientSecretSettingName: "AAD_CLIENT_SECRET",
          },
        },
      },
    };
    process.env.AAD_CLIENT_SECRET = "test-secret";

    await httpTrigger(context, req, brokenAuth as unknown as SWAConfigFileAuth);

    expect(authLoginProviderEmulator).not.toHaveBeenCalled();
    expect(context.res.status).toBe(400);
  });
});
