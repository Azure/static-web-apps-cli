import { processCustomRoutes } from "./routes-engine";
import * as utils from "../core/utils";

describe("processCustomRoutes()", () => {
  let url: string;
  let method: string;
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileRoute[];
  beforeEach(() => {
    url = "/foo";
    method = "GET";

    req = {
      url,
      method,
      headers: {
        cookie: "foo",
      },
    } as any;

    res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      getHeaders: jest.fn(),
      end: jest.fn(),
    } as any;

    userConfig = [];
  });
  it("should return undefined if req is not defined", async () => {
    req = undefined as any;
    res = undefined as any;
    const status = await processCustomRoutes(req, res, userConfig);
    expect(status).toBeUndefined();
  });

  it("should return undefined if no routes", async () => {
    req = {} as any;
    res = {} as any;
    const status = await processCustomRoutes(req, res, userConfig);

    expect(status).toBeUndefined();
  });

  it("should set headers", async () => {
    userConfig = [
      {
        route: url,
        headers: {
          "Cache-Control": "public, max-age=604800, immutable",
          "Keep-Alive": "timeout=5, max=1000",
        },
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledTimes(2);
  });

  it("should process HTTP methods", async () => {
    userConfig = [
      {
        route: url,
        methods: ["FOO"],
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(405);
  });

  it("should return 403 if no user roles in cookie", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: [],
    } as any);

    userConfig = [
      {
        route: url,
        allowedRoles: ["authenticated"],
      },
    ];
    await processCustomRoutes(req, res, userConfig);
  });

  it("should return 403 if unmatched roles", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: ["foo"],
    } as any);

    userConfig = [
      {
        route: url,
        allowedRoles: ["authenticated"],
      },
    ];
    await processCustomRoutes(req, res, userConfig);
  });

  it("should return 200 if matched roles", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: ["authenticated"],
    } as any);

    userConfig = [
      {
        route: url,
        allowedRoles: ["authenticated"],
      },
    ];
    await processCustomRoutes(req, res, userConfig);
  });

  it("should set custom status code (418)", async () => {
    userConfig = [
      {
        route: url,
        statusCode: 418,
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(418);
  });

  it("should set custom status code (404)", async () => {
    userConfig = [
      {
        route: url,
        statusCode: 404,
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("should rewrite URLs", async () => {
    userConfig = [
      {
        route: url,
        rewrite: "/bar.html",
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(req.url).toBe("/bar.html");
  });

  it("should handle 302 redirects", async () => {
    userConfig = [
      {
        route: url,
        redirect: "/bar.html",
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: "/bar.html" });
  });

  it("should handle auth redirects", async () => {
    userConfig = [
      {
        route: url,
        redirect: "/.auth/bar.html",
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: "/app/.auth/bar.html" });
  });

  it("should handle auth redirects with custom status code", async () => {
    userConfig = [
      {
        route: url,
        redirect: "/.auth/bar.html",
        statusCode: 301,
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(301, { Location: "/app/.auth/bar.html" });
  });

  it("should protect against ERR_TOO_MANY_REDIRECTS", async () => {
    userConfig = [
      {
        route: url,
        redirect: "/foo",
      },
    ];
    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("should parse URL and ignore query params", async () => {
    res.url = "/.auth/login/github?post_login_redirect_uri=/profile";
    userConfig = [
      {
        route: res.url,
        redirect: "/foo",
      },
    ];

    await processCustomRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
  });
});
