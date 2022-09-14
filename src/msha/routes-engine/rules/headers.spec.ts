import type http from "http";
import { HEADER_DELETE_KEYWORD } from "../../../core/constants";
import { getHeadersForRoute, getResponseHeaders, updateResponseHeaders } from "./headers";

describe("headers", () => {
  describe("getHeadersForRoute()", () => {
    // TODO: for some weird reason, jest.spyOn() does'nt mock getDefaultHeaders()
    // in this test suite, we are testing both functions: getHeadersForRoute() and getDefaultHeaders().
    it("should return default headers", async () => {
      const headers = getHeadersForRoute(undefined, undefined);

      expect(headers).toEqual({
        "Cache-Control": "must-revalidate, max-age=30",
        ETag: `"SWA-CLI-ETAG"`,
        "Referrer-Policy": "same-origin",
        "Strict-Transport-Security": "max-age=10886400; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-DNS-Prefetch-Control": "off",
        "X-XSS-Protection": "1; mode=block",
      });
    });

    it("should merge route headers with default ones", async () => {
      const headers = getHeadersForRoute({ "x-foo": "bar" }, undefined);

      expect(headers).toEqual({
        "Cache-Control": "must-revalidate, max-age=30",
        ETag: `"SWA-CLI-ETAG"`,
        "Referrer-Policy": "same-origin",
        "Strict-Transport-Security": "max-age=10886400; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-DNS-Prefetch-Control": "off",
        "X-XSS-Protection": "1; mode=block",
        "x-foo": "bar",
      });
    });

    it("should merge global headers with default ones", async () => {
      const headers = getHeadersForRoute(undefined, { "x-foo": "bar" });

      expect(headers).toEqual({
        "Cache-Control": "must-revalidate, max-age=30",
        ETag: `"SWA-CLI-ETAG"`,
        "Referrer-Policy": "same-origin",
        "Strict-Transport-Security": "max-age=10886400; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-DNS-Prefetch-Control": "off",
        "X-XSS-Protection": "1; mode=block",
        "x-foo": "bar",
      });
    });
  });

  describe("getResponseHeaders()", () => {
    it("should return empty headers", () => {
      const response = getResponseHeaders(undefined);
      expect(response).toEqual({});
    });

    it("should return found single header", () => {
      const response = getResponseHeaders({ "x-foo": "bar" });
      expect(response).toEqual({ "x-foo": "bar" });
    });

    it("should return found multiple header", () => {
      const response = getResponseHeaders({ "x-foo": "bar", "x-abc": "123" });
      expect(response).toEqual({ "x-foo": "bar", "x-abc": "123" });
    });

    it("should add deletion placeholder in empty headers", () => {
      const response = getResponseHeaders({ "x-foo": "", "x-abc": "123" });
      expect(response["x-foo"]).toInclude(HEADER_DELETE_KEYWORD);
    });
  });

  describe("updateResponseHeaders()", () => {
    const res = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    } as Partial<http.ServerResponse>;
    it("should not mutate response object if no headers are provided", () => {
      updateResponseHeaders(res as http.ServerResponse, {});
      expect(res.removeHeader).not.toHaveBeenCalled();
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it("should set response header if a headers is provided", () => {
      updateResponseHeaders(res as http.ServerResponse, { "x-foo": "bar" });
      expect(res.setHeader).toHaveBeenCalledWith("x-foo", "bar");
    });

    it("should remove response header if a headers is provided container deletion placeholder", () => {
      updateResponseHeaders(res as http.ServerResponse, { "x-foo": `${HEADER_DELETE_KEYWORD} bar` });
      expect(res.removeHeader).toHaveBeenCalledWith("x-foo");
    });
  });
});
