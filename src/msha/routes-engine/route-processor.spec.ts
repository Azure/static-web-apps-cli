import type http from "http";
import { logger } from "../../core";
import { parseQueryParams } from "./route-processor";

jest.mock("../../core/constants", () => {
  return {
    SWA_CLI_APP_PROTOCOL: "http",
  };
});
jest.spyOn(logger, "silly").mockImplementation(jest.fn());

describe("parseQueryParams()", () => {
  const req = {} as http.IncomingMessage;

  describe("with rewrite rule disabled", () => {
    it("should match /?a=1&b=2 URL", () => {
      req.url = "/?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/");
      expect(matchingRewriteRoute).toBe(req.url);
    });

    it("should match /index.html?a=1&b=2 URL", () => {
      req.url = "/index.html?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/index.html");
      expect(matchingRewriteRoute).toBe(req.url);
    });

    it("should match /foo/bar/index.html?a=1&b=2 URL", () => {
      req.url = "/foo/bar/index.html?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/foo/bar/index.html");
      expect(matchingRewriteRoute).toBe(req.url);
    });

    it("should match /foo/bar/?a=1&b=2 URL", () => {
      req.url = "/foo/bar/?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/foo/bar/");
      expect(matchingRewriteRoute).toBe(req.url);
    });
  });

  describe("with rewrite rule enabled", () => {
    it("should match /?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/?a=1&b=2" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/");
      expect(matchingRewriteRoute).toBe(matchingRouteRule.rewrite);
    });

    it("should match /index.html?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/index.html?a=1&b=2" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/index.html");
      expect(matchingRewriteRoute).toBe(matchingRouteRule.rewrite);
    });

    it("should match /foo/bar/index.html?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/foo/bar/index.html?a=1&b=2" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/foo/bar/index.html");
      expect(matchingRewriteRoute).toBe(matchingRouteRule.rewrite);
    });

    it("should match /foo/bar/?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/foo/bar/?a=1&b=2" };
      const { matchingRewriteRoutePath, matchingRewriteRoute } = parseQueryParams(req, matchingRouteRule);

      expect(matchingRewriteRoutePath).toBe("/foo/bar/");
      expect(matchingRewriteRoute).toBe(matchingRouteRule.rewrite);
    });
  });
});
