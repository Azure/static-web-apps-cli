vi.mock("../../../core/constants", () => {
  return {
    SWA_CLI_APP_PROTOCOL: "http",
  };
});
import { IncomingMessage } from "node:http";
import httpTrigger from "./auth-logout.js";

describe("auth_logout", () => {
  let context: Context;
  let req: IncomingMessage;

  const deletedCookieDefinition = {
    name: "StaticWebAppsAuthCookie",
    value: "deleted",
    path: "/",
    httpOnly: false,
    expires: new Date(1).toUTCString(),
  };

  beforeEach(() => {
    context = {} as Context;
    req = {
      headers: {},
    } as IncomingMessage;
  });

  it("should handle empty config", async () => {
    await httpTrigger(context, req);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(500);
  });

  it("should handle host without port", async () => {
    await httpTrigger(context, {
      headers: {
        host: "0.0.0.0",
      },
    } as IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("http://0.0.0.0/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle host with port", async () => {
    await httpTrigger(context, {
      headers: {
        host: "127.0.0.1:4280",
      },
    } as IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("http://127.0.0.1:4280/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle post_logout_redirect_uri", async () => {
    await httpTrigger(context, {
      url: "/.auth/logout?post_logout_redirect_uri=/foobar",
      headers: {
        host: "127.0.0.1:4280",
      },
    } as IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("http://127.0.0.1:4280/foobar");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle x-forwarded-host header", async () => {
    await httpTrigger(context, {
      url: "/.auth/logout",
      headers: {
        host: "127.0.0.1:4280",
        "x-forwarded-host": "0.0.0.0:8080",
      } as NodeJS.Dict<string | string[]>,
    } as IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("http://0.0.0.0:8080/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle x-forwarded-proto header", async () => {
    await httpTrigger(context, {
      url: "/.auth/logout",
      headers: {
        host: "127.0.0.1:4280",
        "x-forwarded-host": "0.0.0.0:8080",
        "x-forwarded-proto": "https",
      } as NodeJS.Dict<string | string[]>,
    } as IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("https://0.0.0.0:8080/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });
});
