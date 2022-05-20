jest.mock("../../../core/utils/logger", () => {
  return {
    logger: {
      silly: () => {},
    },
  };
});
jest.mock("../../../core/constants", () => {
  return {
    SWA_CLI_OUTPUT_LOCATION: "/",
    SWA_CLI_APP_PROTOCOL: "http",
    IS_APP_DEV_SERVER: () => false,
    ALLOWED_HTTP_METHODS_FOR_STATIC_CONTENT: ["GET", "OPTIONS", "HEAD"],
    AUTH_STATUS: {
      NoAuth: 0,
    },
  };
});

jest.mock("../../../config", () => {
  return {
    DEFAULT_CONFIG: {
      outputLocation: "/",
    },
  };
});

import type http from "http";
import mockFs from "mock-fs";
import { applyRedirectResponse, isRequestMethodValid, isRouteRequiringUserRolesCheck, tryFindFileForRequest, tryGetMatchingRoute } from "./routes";

import * as routeModule from "../route-processor";
import * as cookieModule from "../../../core/utils/cookie";

// btoa is only available in Node.js >= 16
const btoa = (str: string) => Buffer.from(str).toString("base64");

describe("route utilities", () => {
  describe("route", () => {
    describe("tryFindFileForRequest()", () => {
      afterEach(() => {
        mockFs.restore();
      });

      it("should return NULL when file doesn't exist", () => {
        mockFs({
          "/bar.txt": "",
        });

        const filePath = tryFindFileForRequest("foo.png");
        expect(filePath).toBe(null);
      });

      it("should return file path when file exists", () => {
        mockFs({
          "/foo.png": "",
        });

        const filePath = tryFindFileForRequest("foo.png");
        expect(filePath).toBe("foo.png");
      });

      it("should return file path when file (without extension) exists", () => {
        mockFs({
          "/foo": "",
        });

        const filePath = tryFindFileForRequest("foo");
        expect(filePath).toBe("foo");
      });

      it("should return NULL when file (without extension) doesn't exist", () => {
        mockFs({
          "/foo.txt": "",
        });

        const filePath = tryFindFileForRequest("foo");
        expect(filePath).toBe(null);
      });

      it("should return file path when file (w/ space) exists", () => {
        mockFs({
          "/foo bar.png": "",
        });

        const filePath = tryFindFileForRequest("foo bar.png");
        expect(filePath).toBe("foo bar.png");
      });

      it("should return file path when file (w/ percent-encoded symbols) exists", () => {
        mockFs({
          "/with space.html": "",
        });

        const filePath = tryFindFileForRequest("with%20space.html");
        expect(filePath).toBe("with space.html");
      });

      it("should return file path when file exists in subfolder", () => {
        mockFs({
          "/foo/bar.png": "",
        });

        const filePath = tryFindFileForRequest("foo/bar.png");
        expect(filePath).toBe("foo/bar.png");
      });

      it("should return file path when file exists in subfolder (w/ percent-encoded symbols)", () => {
        mockFs({
          "/with space/index.html": "",
        });

        const filePath = tryFindFileForRequest("with%20space/index.html");
        expect(filePath).toBe("with space/index.html");
      });

      it("should return null when index.html does not exist", () => {
        mockFs({
          "/foo": {
            "foo.html": "",
          },
        });

        const filePath = tryFindFileForRequest("/foo/");
        expect(filePath).toBe(null);
      });

      it("should return index.html when folder is provided", () => {
        mockFs({
          "/foo": {
            "index.html": "",
          },
        });

        const filePath = tryFindFileForRequest("/foo/");
        expect(filePath).toBe("/foo/index.html");
      });

      it("should return same file if using dev server", () => {
        mockFs({
          "/foo": {
            "index.html": "",
          },
        });

        const constantsMock = jest.requireMock("../../../core/constants");
        constantsMock.IS_APP_DEV_SERVER = () => true;

        const filePath = tryFindFileForRequest("/foo/index.html");
        expect(filePath).toBe("/foo/index.html");
      });
    });

    describe("isRouteRequiringUserRolesCheck()", () => {
      const req: Partial<http.IncomingMessage> = {};
      const routeDef: Partial<SWAConfigFileRoute> = {};

      let spyDecodeCookie: jest.SpyInstance;
      beforeEach(() => {
        spyDecodeCookie = jest.spyOn(cookieModule, "decodeCookie");
      });

      it("should not require user roles check when route rule is undefined", () => {
        const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, undefined, false, 0);
        expect(checkStatus).toBe(true);
      });

      it("should not require user roles check when no route rule is provided", () => {
        const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, false, 0);
        expect(checkStatus).toBe(true);
      });

      it("should not require user roles check when allowedRoles is empty", () => {
        routeDef.allowedRoles = [];
        const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, false, 0);
        expect(checkStatus).toBe(true);
      });

      it("should not lookup auth cookie when when allowedRoles has anonymous role", () => {
        routeDef.allowedRoles = ["anonymous"];
        const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, false, 0);
        expect(checkStatus).toBe(true);
      });

      describe("when 'allowedRoles' has valid role", () => {
        it("should return false when no headers are set", () => {
          routeDef.allowedRoles = ["admin"];
          req.headers = undefined;

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, false, 0);
          expect(spyDecodeCookie).not.toHaveBeenCalled();
          expect(checkStatus).toBe(false);
        });
        it("should return false when no cookies are set in headers", () => {
          routeDef.allowedRoles = ["admin"];
          req.headers = {
            cookie: undefined,
          };

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, true, 0);
          expect(spyDecodeCookie).not.toHaveBeenCalled();
          expect(checkStatus).toBe(false);
        });
        it("should return false when no StaticWebAppsAuthCookie cookie is set in headers.cookie", () => {
          routeDef.allowedRoles = ["admin"];
          req.headers = {
            cookie: "foo=bar",
          };
          spyDecodeCookie.mockReturnValue(null);

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, true, 0);
          expect(spyDecodeCookie).toHaveBeenCalledWith("foo=bar");
          expect(checkStatus).toBe(false);
        });

        it("should return false when StaticWebAppsAuthCookie cookie is set but has invalid ClientPrincipal", () => {
          routeDef.allowedRoles = ["admin"];
          req.headers = {
            cookie: "StaticWebAppsAuthCookie=bar",
          };
          spyDecodeCookie.mockReturnValue("bar");

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, true, 0);
          expect(spyDecodeCookie).toHaveBeenCalledWith("StaticWebAppsAuthCookie=bar");
          expect(checkStatus).toBe(false);
        });

        it("should return true when StaticWebAppsAuthCookie cookie is set and has valid ClientPrincipal", () => {
          const clientPrincipal = {
            identityProvider: "foo",
            userId: "foo",
            userDetails: "foo",
            userRoles: ["admin"],
          };
          const clientPrincipalBase64 = btoa(JSON.stringify(clientPrincipal));

          routeDef.allowedRoles = ["admin"];
          req.headers = {
            cookie: `StaticWebAppsAuthCookie=${clientPrincipalBase64}`,
          };
          spyDecodeCookie.mockReturnValue(clientPrincipal);

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, true, 0);
          expect(spyDecodeCookie).toHaveBeenCalledWith(`StaticWebAppsAuthCookie=${clientPrincipalBase64}`);
          expect(checkStatus).toBe(true);
        });

        it("should return false when StaticWebAppsAuthCookie cookie is set but roles do not match", () => {
          const clientPrincipal = {
            identityProvider: "foo",
            userId: "foo",
            userDetails: "foo",
            userRoles: ["foo"],
          };
          const clientPrincipalBase64 = btoa(JSON.stringify(clientPrincipal));

          routeDef.allowedRoles = ["admin"];
          req.headers = {
            cookie: `StaticWebAppsAuthCookie=${clientPrincipalBase64}`,
          };
          spyDecodeCookie.mockReturnValue(clientPrincipal);

          const checkStatus = isRouteRequiringUserRolesCheck(req as http.IncomingMessage, routeDef as SWAConfigFileRoute, true, 0);
          expect(spyDecodeCookie).toHaveBeenCalledWith(`StaticWebAppsAuthCookie=${clientPrincipalBase64}`);
          expect(checkStatus).toBe(false);
        });
      });
    });

    // note: we are testing non-legacy (old) config only!
    describe("tryGetMatchingRoute() - isLegacyConfigFile = false", () => {
      const req: Partial<http.IncomingMessage> = {
        url: "/",
        headers: {
          host: "0.0.0.0",
        },
      };
      const userConfig: Partial<SWAConfigFile> = {
        isLegacyConfigFile: false,
        routes: [
          {
            route: "/",
          },
        ],
      };
      let spyDoesRequestPathMatchRoute: jest.SpyInstance;
      let spyDoesRequestPathMatchLegacyRoute: jest.SpyInstance;
      beforeEach(() => {
        spyDoesRequestPathMatchRoute = jest.spyOn(routeModule, "doesRequestPathMatchRoute");
        spyDoesRequestPathMatchLegacyRoute = jest.spyOn(routeModule, "doesRequestPathMatchLegacyRoute");
      });

      it("should return undefined when no route provided", () => {
        userConfig.routes = [];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return undefined when routes is undefined", () => {
        delete userConfig.routes;
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return undefined when a route is invalid", () => {
        userConfig.routes = [
          {
            route: "",
          },
        ];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return route rule when route is matched", () => {
        req.url = "/foo";
        userConfig.routes = [{ route: "/foo" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(true);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toEqual({ route: "/foo" });
      });

      it("should return undefined when route is not matched", () => {
        req.url = "/foo";
        userConfig.routes = [{ route: "/bar" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return route rule when route is file and is matched", () => {
        req.url = "/foo.txt";
        userConfig.routes = [{ route: "/foo.txt" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(true);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toEqual({ route: "/foo.txt" });
      });

      it("should return undefined when route is file and is not matched", () => {
        req.url = "/foo.txt";
        userConfig.routes = [{ route: "/foo.jpg" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return rule when route with redirect is matched", () => {
        req.url = "/foo";
        userConfig.routes = [{ route: "/foo", redirect: "/bar" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(true);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toEqual({ route: "/foo", redirect: "http://0.0.0.0/bar" });
      });

      it("should return undefined when redirection loop is detected", () => {
        req.url = "/foo";
        userConfig.routes = [{ route: "/foo", redirect: "/foo" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });

      it("should return undefined when all routes don't match", () => {
        req.url = "/no-match";
        userConfig.routes = [{ route: "/foo" }, { route: "/bar'" }];
        spyDoesRequestPathMatchRoute.mockReturnValue(false);
        spyDoesRequestPathMatchLegacyRoute.mockReturnValue(false);

        const matchedRoute = tryGetMatchingRoute(req as http.IncomingMessage, userConfig as SWAConfigFile);
        expect(matchedRoute).toBe(undefined);
      });
    });

    describe("isRequestMethodValid()", () => {
      const testHttpMethods = ["GET", "POST", "DELETE", "PUT", "PATCH", "HEAD", "OPTIONS"];
      const req: Partial<http.IncomingMessage> = {};
      function test(method: string, isFunctionRequest: boolean, isAuth: boolean, expectedValue: boolean) {
        return () => {
          req.method = method;
          const isValid = isRequestMethodValid(req as http.IncomingMessage, isFunctionRequest, isAuth);
          expect(isValid).toBe(expectedValue);
        };
      }

      it("should return false when no method is provided", () => {
        const isValid = isRequestMethodValid(req as http.IncomingMessage, false, false);
        expect(isValid).toBe(false);
      });

      it("should return false when method is not valid", () => {
        req.method = "FOO";
        const isValid = isRequestMethodValid(req as http.IncomingMessage, false, false);
        expect(isValid).toBe(false);
      });

      describe("when request is for static", () => {
        ["GET", "HEAD", "OPTIONS"].forEach((method) => {
          it(`should return true when for valid method ${method}`, test(method, false, false, true));
        });
        ["POST", "DELETE", "PUT", "PATCH"].forEach((method) => {
          it(`should return true when for invalid method ${method}`, test(method, false, false, false));
        });
      });

      describe("when request is for Functions", () => {
        testHttpMethods.forEach((method) => {
          it(`should return true when method is ${method}`, test(method, true, false, true));
        });
      });

      describe("when request is for auth", () => {
        testHttpMethods.forEach((method) => {
          it(`should return true when method is ${method}`, test(method, false, true, true));
        });
      });
    });
  });

  describe("applyRedirectResponse()", () => {
    const req: Partial<http.IncomingMessage> = {};
    const res: Partial<http.ServerResponse> = {
      setHeader: jest.fn(),
      end: jest.fn(),
    };
    const routeDef: Partial<SWAConfigFileRoute> = {};
    beforeEach(() => {
      jest.resetAllMocks();
    });
    it("should not apply redirect header when no redirect rule is provided", () => {
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.getHeader?.("Location")).toBe(undefined);
    });

    it("should not change status code when no redirect rule is provided", () => {
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(undefined);
    });

    it("should not change status code when no redirect rule is invalid", () => {
      routeDef.redirect = "";
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(undefined);
    });

    it("should add Location header when redirect rule is provided", () => {
      routeDef.redirect = "/foo";
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.setHeader).toHaveBeenCalledWith("Location", routeDef.redirect);
    });

    it("should set 302 status code when redirect rule is provided with no statusCode rule", () => {
      routeDef.redirect = "/foo";
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(302);
    });

    it("should set 302 status code when redirect rule is provided with statusCode 302", () => {
      routeDef.redirect = "/foo";
      routeDef.statusCode = 302;
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(302);
    });

    it("should set 301 status code when redirect rule is provided with statusCode 301", () => {
      routeDef.redirect = "/foo";
      routeDef.statusCode = 301;
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(301);
    });

    it("should set 302 status code when redirect rule is provided with statusCode != 301,302", () => {
      routeDef.redirect = "/foo";
      routeDef.statusCode = 200;
      applyRedirectResponse(req as http.IncomingMessage, res as http.ServerResponse, routeDef as SWAConfigFileRoute);
      expect(res.statusCode).toBe(302);
    });
  });
});
