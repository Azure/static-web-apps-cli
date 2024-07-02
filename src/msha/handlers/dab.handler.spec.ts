import http from "node:http";
import { injectHeaders, isDataApiRequest } from "./dab.handler.js";

describe("isDataApiRequest", () => {
  beforeEach(() => {
    // Reset the mocked functions before each test
    jest.clearAllMocks();
  });

  it('returns true when the path starts with "/data-api/"', () => {
    const req = { url: "/data-api/users" } as http.IncomingMessage;
    const result = isDataApiRequest(req);
    expect(result).toEqual(true);
  });

  it('returns false when the path equals "/data-api" (without trailing slash)', () => {
    const req = { url: "/data-api" } as http.IncomingMessage;
    const result = isDataApiRequest(req);
    expect(result).toEqual(false);
  });

  it('returns true when the path equals "/DATa-Api/" (should ignore case while comparing)', () => {
    const req = { url: "/DATa-Api/" } as http.IncomingMessage;
    const result = isDataApiRequest(req);
    expect(result).toEqual(true);
  });

  it('returns false when the path has "/data-api" in between', () => {
    const req = { url: "/xyz/data-api/abc" } as http.IncomingMessage;
    const result = isDataApiRequest(req);
    expect(result).toEqual(false);
  });

  it('returns false when the path does not start with "/data-api/"', () => {
    const req = { url: "/api/users" } as http.IncomingMessage;
    const result = isDataApiRequest(req);
    expect(result).toEqual(false);
  });

  it("returns true when the path starts with a custom rewrite path", () => {
    const req = { url: "/api/users" } as http.IncomingMessage;
    const result = isDataApiRequest(req, "/data-api/users");
    expect(result).toEqual(true);
  });
});

describe("injectHeaders", () => {
  let req: http.ClientRequest;

  beforeEach(() => {
    req = {
      getHeader: jest.fn(),
      setHeader: jest.fn(),
      path: "/example/path",
    } as unknown as http.ClientRequest;
  });

  it("sets x-ms-original-url header if not already set", () => {
    const host = "http://example.com";
    injectHeaders(req, host);
    const expectedUrl = "http://example.com/example/path";
    expect(req.setHeader).toHaveBeenCalledWith("x-ms-original-url", expectedUrl);
  });

  it("does not set x-ms-original-url header if already set", () => {
    const host = "http://example.com";
    req.getHeader = jest.fn((headerName) => {
      if (headerName === "x-ms-original-url") {
        return "http://original-url.com";
      }
      return "";
    });
    injectHeaders(req, host);
    expect(req.setHeader).not.toHaveBeenCalledWith("x-ms-original-url", expect.anything());
  });

  it("sets x-ms-request-id header with a correlation ID", () => {
    const host = "http://example.com";
    injectHeaders(req, host);
    const xMsRequestIdHeader = "x-ms-request-id";
    const expectedValueRegex = /^SWA-CLI-[0-9A-Z]+$/;
    expect(req.setHeader).toHaveBeenCalledWith(xMsRequestIdHeader, expect.stringMatching(expectedValueRegex));
  });

  it("should override x-ms-request-id header with newly generated value", () => {
    const host = "http://example.com";
    const xMsRequestIdHeader = "x-ms-request-id";
    req.setHeader(xMsRequestIdHeader, "xyz");
    injectHeaders(req, host);
    const expectedValueRegex = /^SWA-CLI-[0-9A-Z]+$/;
    expect(req.setHeader).toHaveBeenCalledWith(xMsRequestIdHeader, expect.stringMatching(expectedValueRegex));
  });
});
