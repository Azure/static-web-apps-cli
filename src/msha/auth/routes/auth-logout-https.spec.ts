jest.mock("../../../core/constants", () => {
  return {
    SWA_CLI_APP_PROTOCOL: "https",
  };
});
import type http from "http";
import httpTrigger from "./auth-logout";

describe("auth-logout-https", () => {
  let context: Context;
  let req: http.IncomingMessage;

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
    } as http.IncomingMessage;
  });

  it("should handle empty config (https)", async () => {
    await httpTrigger(context, req);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(500);
  });

  it("should handle host without port (https)", async () => {
    await httpTrigger(context, {
      headers: {
        host: "0.0.0.0",
      },
    } as http.IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("https://0.0.0.0/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle host with port (https)", async () => {
    await httpTrigger(context, {
      headers: {
        host: "127.0.0.1:4280",
      },
    } as http.IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("https://127.0.0.1:4280/");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });

  it("should handle post_logout_redirect_uri (https)", async () => {
    await httpTrigger(context, {
      url: "/.auth/logout?post_logout_redirect_uri=/foobar",
      headers: {
        host: "127.0.0.1:4280",
      },
    } as http.IncomingMessage);

    expect(context.res.body).toBe(null);
    expect(context.res.status).toBe(302);
    expect(context.res.headers?.Location).toBe("https://127.0.0.1:4280/foobar");
    expect(context.res.cookies?.[0]).toEqual(deletedCookieDefinition);
  });
});
