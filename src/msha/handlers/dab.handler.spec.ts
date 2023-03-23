import http from "http";
import { URL } from "url";
import { injectHeaders, isDataApiRequest } from "./dab.handler";

describe("isDataApiRequest", () => {
  const req = { url: "/data-api/users" } as http.IncomingMessage;

  it('returns true when the path starts with "/data-api/"', () => {
    const result = isDataApiRequest(req);
    expect(result).toEqual(true);
  });

  it('returns false when the path does not start with "/data-api/"', () => {
    const req2 = { url: "/api/users" } as http.IncomingMessage;
    const result = isDataApiRequest(req2);
    expect(result).toEqual(false);
  });

  it("returns true when the path starts with a custom rewrite path", () => {
    const req2 = { url: "/api/users" } as http.IncomingMessage;
    const result = isDataApiRequest(req2, "/data-api/users");
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
    const expectedUrl = encodeURI(new URL(req.path!, host).toString());
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

  it("sets x-ms-request-id header with a fake ID", () => {
    const host = "http://example.com";
    injectHeaders(req, host);
    const xMsRequestIdHeader = "x-ms-request-id";
    const expectedValueRegex = /^SWA-CLI-[0-9A-Z]+$/;
    expect(req.setHeader).toHaveBeenCalledWith(xMsRequestIdHeader, expect.stringMatching(expectedValueRegex));
  });
});
