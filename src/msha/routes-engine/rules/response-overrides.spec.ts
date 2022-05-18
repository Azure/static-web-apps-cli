import { CUSTOM_URL_SCHEME } from "../../../core/constants";
import { responseOverrides } from "./response-overrides";

describe("responseOverrides()", () => {
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileResponseOverrides;
  beforeEach(() => {
    req = {} as any;

    res = {
      statusCode: 200,
      setHeader: jest.fn(),
    } as any;

    userConfig = {};
  });

  it("should not override response if empty config", () => {
    res.statusCode = 200;
    responseOverrides(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should check for undefined config", () => {
    req.url = "/foo";
    responseOverrides(req, res, undefined as any);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should check for null config", () => {
    req.url = "/foo";
    responseOverrides(req, res, null as any);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not override response if no statusCode", () => {
    res.statusCode = null;
    responseOverrides(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should override rewrite rule", () => {
    res.statusCode = 404;
    userConfig = {
      "404": {
        rewrite: "/foo",
      },
    };
    responseOverrides(req, res, userConfig);

    expect(req.url).toBe(`${CUSTOM_URL_SCHEME}foo`);
  });

  it("should override redirect rule", () => {
    res.statusCode = 404;
    userConfig = {
      "404": {
        redirect: "/foo",
      },
    };
    responseOverrides(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledWith("Location", "/foo");
  });

  it("should override statusCode rule", () => {
    res.statusCode = 404;
    userConfig = {
      "404": {
        statusCode: 200,
      },
    };
    responseOverrides(req, res, userConfig);

    expect(res.statusCode).toBe(200);
  });

  [400, 401, 403, 404].forEach((code) => {
    it(`should override statusCode for HTTP code ${code}`, () => {
      res.statusCode = code;
      userConfig = {
        [code]: {
          statusCode: 200,
        },
      };
      responseOverrides(req, res, userConfig);

      expect(res.statusCode).toBe(200);
    });
  });

  const codes = [
    100, 101, 102, 200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 307, 308, 405, 406, 407, 408, 409, 410, 411, 412,
    413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 426, 428, 429, 431, 444, 451, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511, 599,
  ];
  for (let index = 0; index < codes.length; index++) {
    const code = codes[index];
    it(`should NOT override statusCode for HTTP code ${code}`, () => {
      res.statusCode = code;
      userConfig = {
        [code]: {
          statusCode: 200,
        },
      };
      responseOverrides(req, res, userConfig);
      expect(res.statusCode).toBe(code);
    });
  }
});
