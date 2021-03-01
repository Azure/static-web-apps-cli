import { globalHeaders } from "./globalHeaders";

describe("globalHeaders()", () => {
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileGlobalHeaders;
  beforeEach(() => {
    req = {} as any;

    res = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    } as any;

    userConfig = {};
  });

  it("should not set headers if empty config", async () => {
    await globalHeaders(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should add new headers", async () => {
    userConfig = {
      "Cache-Control": "public, max-age=604800",
    };
    await globalHeaders(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=604800");
  });

  it("should remove exsting header", async () => {
    userConfig = {
      "Cache-Control": "",
    };
    await globalHeaders(req, res, userConfig);

    expect(res.removeHeader).toHaveBeenCalledWith("Cache-Control");
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
