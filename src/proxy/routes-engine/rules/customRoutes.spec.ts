import * as utils from "../../../core/utils";
import { customRoutes, matchRoute } from "./customRoutes";

describe("customRoutes()", () => {
  let method: string;
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileRoute[];
  beforeEach(() => {
    method = "GET";

    req = {
      url: "/foo",
      method,
      headers: {
        cookie: "foo",
      },
    } as any;

    res = {
      statusCode: 200,
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
    const status = await customRoutes(req, res, userConfig);

    expect(status).toBeUndefined();
  });

  it("should return undefined if no routes", async () => {
    req = {} as any;
    res = {} as any;
    const status = await customRoutes(req, res, userConfig);

    expect(status).toBeUndefined();
  });

  it("should check for undefined config", async () => {
    req.url = "/foo";
    const status = await customRoutes(req, res, undefined as any);

    expect(status).toBeUndefined();
  });

  it("should check for null config", async () => {
    req.url = "/foo";
    const status = await customRoutes(req, res, null as any);

    expect(status).toBeUndefined();
  });

  it("should set headers", async () => {
    userConfig = [
      {
        route: "/foo",
        headers: {
          "Cache-Control": "public, max-age=604800, immutable",
          "Keep-Alive": "timeout=5, max=1000",
        },
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledTimes(2);
  });

  it("should process HTTP methods", async () => {
    userConfig = [
      {
        route: "/foo",
        methods: ["FOO"],
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(405);
  });

  it("should return 403 if no user roles in cookie", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: [],
    } as any);

    userConfig = [
      {
        route: "/foo",
        allowedRoles: ["authenticated"],
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(403);
  });

  it("should return 403 if unmatched roles", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: ["foo"],
    } as any);

    userConfig = [
      {
        route: "/foo",
        allowedRoles: ["authenticated"],
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(403);
  });

  it("should return 200 if matched roles", async () => {
    jest.spyOn(utils, "decodeCookie").mockReturnValue({
      userRoles: ["authenticated"],
    } as any);

    userConfig = [
      {
        route: "/foo",
        allowedRoles: ["authenticated"],
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(200);
  });

  it("should set custom status code (418)", async () => {
    userConfig = [
      {
        route: "/foo",
        statusCode: 418,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(418);
  });

  it("should set custom status code (404)", async () => {
    userConfig = [
      {
        route: "/foo",
        statusCode: 404,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("should rewrite URLs", async () => {
    userConfig = [
      {
        route: "/foo",
        rewrite: "/bar.html",
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(req.url).toBe("/bar.html");
  });

  it("should handle 302 redirects", async () => {
    userConfig = [
      {
        route: "/foo",
        redirect: "/bar.html",
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: "/bar.html" });
  });

  it("should serve with redirect (statusCode=302)", async () => {
    userConfig = [
      {
        route: "/foo",
        serve: "/bar",
        statusCode: 302,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: "/bar" });
  });

  it("should serve with redirect (statusCode=301)", async () => {
    userConfig = [
      {
        route: "/foo",
        serve: "/bar",
        statusCode: 301,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).toHaveBeenCalledWith(301, { Location: "/bar" });
  });

  it("should not serve with redirect (statusCode=200)", async () => {
    userConfig = [
      {
        route: "/foo",
        serve: "/bar",
        statusCode: 200,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("should serve with rewrite (statusCode=200)", async () => {
    userConfig = [
      {
        route: "/foo",
        serve: "/bar",
        statusCode: 200,
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
    expect(req.url).toBe("/bar");
  });

  it("should serve with rewrite (statusCode = undefined)", async () => {
    userConfig = [
      {
        route: "/foo",
        serve: "/bar",
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(req.url).toBe("/bar");
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("should protect against ERR_TOO_MANY_REDIRECTS", async () => {
    userConfig = [
      {
        route: "/foo",
        redirect: "/foo",
      },
    ];
    await customRoutes(req, res, userConfig);

    expect(res.writeHead).not.toHaveBeenCalled();
  });

  it("should parse URL and ignore query params", async () => {
    req.url = "/.auth/login/github?post_login_redirect_uri=/profile";
    userConfig = [
      {
        route: "/.auth/login/github",
        statusCode: 403,
      },
    ];

    await customRoutes(req, res, userConfig);

    expect(res.statusCode).toBe(403);
  });

  describe("Wildcards", () => {
    it("should match root wildcards /*", async () => {
      req.url = "/.auth/login/github?post_login_redirect_uri=/profile";
      userConfig = [
        {
          route: "/*",
        },
      ];

      const regex = matchRoute(req, res)(userConfig[0]);
      expect(regex).toBe(true);
    });

    it("should match sub paths wildcards", async () => {
      req.url = "/.auth/login/github";
      userConfig = [
        {
          route: "/.auth/*",
        },
      ];

      const regex = matchRoute(req, res)(userConfig[0]);
      expect(regex).toBe(true);
    });

    it("should not match wrong sub paths wildcards", async () => {
      req.url = "/.xyz/login/github";
      userConfig = [
        {
          route: "/.auth/*",
        },
      ];

      const regex = matchRoute(req, res)(userConfig[0]);
      expect(regex).toBe(false);
    });

    it("should match file-based wildcards", async () => {
      req.url = "/assets/foo.png";
      userConfig = [
        {
          route: "/assets/*.{png,svg}",
        },
      ];

      const regex = matchRoute(req, res)(userConfig[0]);
      expect(regex).toBe(true);
    });

    it("should not match wrong file-based wildcards", async () => {
      req.url = "/assets/foo.svg";
      userConfig = [
        {
          route: "/assets/*.{png}",
        },
      ];

      const regex = matchRoute(req, res)(userConfig[0]);
      expect(regex).toBe(false);
    });
  });
});
