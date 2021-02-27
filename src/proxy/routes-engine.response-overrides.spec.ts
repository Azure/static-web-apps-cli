import { processResponseOverrides } from "./routes-engine";

describe("processResponseOverrides()", () => {
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

  it("should not override response if empty config", async () => {
    res.statusCode = 200;
    await processResponseOverrides(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not override response if no statusCode", async () => {
    res.statusCode = null;
    await processResponseOverrides(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should override rewrite rule", async () => {
    res.statusCode = 200;
    userConfig = {
      "200": {
        rewrite: "/foo",
      },
    };
    await processResponseOverrides(req, res, userConfig);

    expect(req.url).toBe("/foo");
  });

  it("should override redirect rule", async () => {
    res.statusCode = 200;
    userConfig = {
      "200": {
        redirect: "/foo",
      },
    };
    await processResponseOverrides(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledWith("Location", "/foo");
  });

  it("should override statusCode rule", async () => {
    res.statusCode = 200;
    userConfig = {
      "200": {
        statusCode: 404,
      },
    };
    await processResponseOverrides(req, res, userConfig);

    expect(res.statusCode).toBe(404);
  });
});
