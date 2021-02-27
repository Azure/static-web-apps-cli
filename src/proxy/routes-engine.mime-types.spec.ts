import { processMimeTypes } from "./routes-engine";

describe("processMimeTypes()", () => {
  let req: any;
  let res: any;
  let userConfig: SWAConfigFileGlobalHeaders;
  beforeEach(() => {
    req = {} as any;

    res = {
      setHeader: jest.fn(),
    } as any;

    userConfig = {};
  });

  it("should not add mime types if empty config", async () => {
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not add mime types if URL doesnt include a file extension", async () => {
    req.url = "/foo";
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not add mime type if URL includes a file extension but no config match", async () => {
    req.url = "/foo.jpg";
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not add mime type if URL includes a file extension not in config", async () => {
    req.url = "/foo.html";
    userConfig = {
      ".jpg": "text/json",
    };
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it("should not add mime type if URL includes a file extension and config match", async () => {
    req.url = "/foo.jpg";
    userConfig = {
      ".jpg": "text/json",
    };
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/json");
  });

  it("should add mime type if URL includes a file extension with many dots", async () => {
    req.url = "/foo.bar.jpg";
    userConfig = {
      ".jpg": "text/json",
    };
    await processMimeTypes(req, res, userConfig);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/json");
  });
});
