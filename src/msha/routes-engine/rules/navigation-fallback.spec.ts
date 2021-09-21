jest.mock("../../../core/constants", () => {});
import mockFs from "mock-fs";

import { navigationFallback } from "./navigation-fallback";

describe("navigationFallback()", () => {
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileNavigationFallback;
  beforeEach(() => {
    req = {} as any;
    res = {} as any;
    userConfig = {} as any;
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("should not process fallbacks if empty config", () => {
    req.url = "/foo";
    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/foo");
  });

  it("should check for undefined config", () => {
    req.url = "/foo";
    navigationFallback(req, res, undefined as any);

    expect(req.url).toBe("/foo");
  });

  it("should check for null config", () => {
    req.url = "/foo";
    navigationFallback(req, res, null as any);

    expect(req.url).toBe("/foo");
  });

  it("should not process fallbacks if /.auth/**", () => {
    req.url = "/.auth/login/github?post_login_redirect_uri=/profile";
    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/.auth/login/github?post_login_redirect_uri=/profile");
  });

  it("should not process fallbacks if /api/**", () => {
    req.url = "/api/foo/bar";
    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/api/foo/bar");
  });

  it("should not process fallbacks if file found and matched exclude filter", () => {
    req.url = "/images/foo.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/images/*.{png,jpg,gif}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/images/foo.png": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo.png");
  });

  it("should not process fallbacks if file not found but matched exclude filter", () => {
    req.url = "/images/foo.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/images/*.{png,jpg,gif}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/no-file": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo.png");
  });

  it("should process fallbacks if file found but not matched exclude filter", () => {
    req.url = "/images/foo.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/images/*.{gif}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/images/foo.png": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/bar");
  });

  it("should process fallbacks if file not found and not matched exclude filter", () => {
    req.url = "/images/foo.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/images/*.{gif}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/no-file": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/bar");
  });

  it("should expand wildcards (/*.{png}) into valid glob wildcards (/**/*.{png})", () => {
    req.url = "/images/foo/bar.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/*.{png}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/no-file": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo/bar.png");
  });

  it("should expand wildcards (/images/*.{png}) into valid glob wildcards (/images/**/*.{png})", () => {
    req.url = "/images/foo/bar.png";
    userConfig = {
      rewrite: "/bar",
      exclude: ["/images/*.{png}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/no-file": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo/bar.png");
  });

  it("should ignore fallback if no exclude property is provided", () => {
    req.url = "/images/foo/bar.png";
    userConfig = {
      rewrite: "/bar",
    };
    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo/bar.png");
  });

  it("should ignore fallback if exclude list is empty", () => {
    req.url = "/images/foo/bar.png";
    userConfig = {
      rewrite: "/bar",
      exclude: [],
    };
    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/images/foo/bar.png");
  });

  it("should work if function is used as a fallback", () => {
    req.url = "/images/foo.png";
    userConfig = {
      rewrite: "/api/test",
      exclude: ["/images/*.{gif}"],
    };
    process.env.SWA_CLI_OUTPUT_LOCATION = "/";

    mockFs({
      "/no-file": "",
    });

    navigationFallback(req, res, userConfig);

    expect(req.url).toBe("/api/test");
  });
});
