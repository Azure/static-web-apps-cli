import type http from "http";
import { parseQueryParams } from "./route-processor";

describe("parseQueryParams()", () => {
  const req = {} as http.IncomingMessage;

  describe("with rewrite rule disabled", () => {
    it("should match /?a=1&b=2 URL", () => {
      req.url = "/?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/");
      expect(urlPathnameWithQueryParams).toBe(req.url);
    });

    it("should match /index.html?a=1&b=2 URL", () => {
      req.url = "/index.html?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/index.html");
      expect(urlPathnameWithQueryParams).toBe(req.url);
    });

    it("should match /foo/bar/index.html?a=1&b=2 URL", () => {
      req.url = "/foo/bar/index.html?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/foo/bar/index.html");
      expect(urlPathnameWithQueryParams).toBe(req.url);
    });

    it("should match /foo/bar/?a=1&b=2 URL", () => {
      req.url = "/foo/bar/?a=1&b=2";
      const matchingRouteRule = { route: "/" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/foo/bar/");
      expect(urlPathnameWithQueryParams).toBe(req.url);
    });
  });

  describe("with rewrite rule enabled", () => {
    it("should match /?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/?a=1&b=2" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/");
      expect(urlPathnameWithQueryParams).toBe(matchingRouteRule.rewrite);
    });

    it("should match /index.html?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/index.html?a=1&b=2" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/index.html");
      expect(urlPathnameWithQueryParams).toBe(matchingRouteRule.rewrite);
    });

    it("should match /foo/bar/index.html?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/foo/bar/index.html?a=1&b=2" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/foo/bar/index.html");
      expect(urlPathnameWithQueryParams).toBe(matchingRouteRule.rewrite);
    });

    it("should match /foo/bar/?a=1&b=2 URL", () => {
      const matchingRouteRule = { route: "/", rewrite: "/foo/bar/?a=1&b=2" };
      const { urlPathnameWithoutQueryParams, urlPathnameWithQueryParams } = parseQueryParams(req, matchingRouteRule);

      expect(urlPathnameWithoutQueryParams).toBe("/foo/bar/");
      expect(urlPathnameWithQueryParams).toBe(matchingRouteRule.rewrite);
    });
  });
});
