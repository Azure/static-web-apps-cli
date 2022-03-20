import mockFs from "mock-fs";
import path from "path";
import { DEPLOY_BINARY_NAME, DEPLOY_FOLDER, fetchLatestClientVersionDefinition, getLocalClientMetadata } from "./deploy-client";

jest.mock("node-fetch", () => jest.fn());

function mockResponse(response: any, status = 200) {
  const fetchMock = jest.requireMock("node-fetch");
  fetchMock.mockImplementationOnce(() =>
    Promise.resolve({
      status,
      json: () => Promise.resolve(response),
    })
  );
}

function getMockedLocalClientMetadata() {
  return {
    metadata: {
      version: "latest",
      publishDate: "2022-03-05",
      files: {
        "linux-x64": {
          url: "https://swalocaldeploy.azureedge.net/downloads/latest/linux/StaticSitesClient",
          sha256: "C3E935B26A074B4F342FBF03CA6665777A1B11AF4B35D76BF5A196398E3A95F3",
        },
        "win-x64": {
          url: "https://swalocaldeploy.azureedge.net/downloads/latest/windows/StaticSitesClient.exe",
          sha256: "0151190D520B47332CF2D3E5340D8B8F144B0F4DF15D5E54C8DE80D374A2A201",
        },
        "osx-x64": {
          url: "https://swalocaldeploy.azureedge.net/downloads/latest/darwin/StaticSitesClient",
          sha256: "E9E97E82EB0F50FDB40639A5DFF46E78DB4251C9036EE9A82E73931234CEF5CF",
        },
      },
    },
    binary: path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME),
    checksum: "e9e97e82eb0f50fdb40639a5dff46e78db4251c9036ee9a82e73931234cef5cf",
  };
}

describe("fetchLatestClientVersionDefinition()", () => {
  describe("should return undefined when API response is", () => {
    it("an empty object", async () => {
      mockResponse({});

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("an empty array", async () => {
      mockResponse([]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("NULL", async () => {
      mockResponse(null);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("undefined", async () => {
      mockResponse(undefined);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("a string", async () => {
      mockResponse("");

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("a list of empty objects", async () => {
      mockResponse([{}]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("a list of NULLs", async () => {
      mockResponse([null]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("a list of empty arrays", async () => {
      mockResponse([[]]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("a list of empty strings", async () => {
      mockResponse([""]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });

    it("version property is not 'latest'", async () => {
      mockResponse([
        {
          version: "",
        },
      ]);

      const result = await fetchLatestClientVersionDefinition();
      expect(result).toBe(undefined);
    });
  });
});

describe("getLocalClientMetadata()", () => {
  afterAll(() => {
    mockFs.restore();
  });

  it("should return null when local metadata is not defined", () => {
    mockFs({
      [path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)]: "",
    });

    const result = getLocalClientMetadata();
    expect(result).toBe(null);
  });

  it("should return null when content is invalid JSON", () => {
    mockFs({
      [path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)]: '123"foo": "bar"},,,,',
    });

    const result = getLocalClientMetadata();
    expect(result).toBe(null);
  });

  it("should return null if the metadata config file is missing", () => {
    mockFs({
      [path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)]: "<binary content>",
    });

    const result = getLocalClientMetadata();
    expect(result).toEqual(null);
  });

  it("should return null if the local binary file is missing", () => {
    const content = getMockedLocalClientMetadata();
    mockFs({
      [`${path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)}.json`]: JSON.stringify(content),
    });

    const result = getLocalClientMetadata();
    expect(result).toEqual(null);
  });

  it("should return local metadata when both config and binary files are defined", () => {
    const content = getMockedLocalClientMetadata();
    mockFs({
      [`${path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)}.json`]: JSON.stringify(content),
      [path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)]: "<binary content>",
    });

    const result = getLocalClientMetadata();
    expect(result).toEqual(content);
  });

  it("should return local metadata when both config and binary files are defined", () => {
    const content = getMockedLocalClientMetadata();
    mockFs({
      [`${path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)}.json`]: JSON.stringify(content),
      [path.join(DEPLOY_FOLDER, DEPLOY_BINARY_NAME)]: "<binary content>",
    });

    const result = getLocalClientMetadata();
    expect(result?.binary).toBeDefined();
    expect(result?.checksum).toBeDefined();
    expect(result?.metadata).toBeDefined();
    expect(result?.metadata.version).toBeDefined();
    expect(result?.metadata.publishDate).toBeDefined();

    expect(result?.metadata.files["linux-x64"]).toBeDefined();
    expect(result?.metadata.files["linux-x64"].sha256).toBeDefined();
    expect(result?.metadata.files["linux-x64"].url).toBeDefined();

    expect(result?.metadata.files["osx-x64"]).toBeDefined();
    expect(result?.metadata.files["osx-x64"].sha256).toBeDefined();
    expect(result?.metadata.files["osx-x64"].url).toBeDefined();

    expect(result?.metadata.files["win-x64"]).toBeDefined();
    expect(result?.metadata.files["win-x64"].sha256).toBeDefined();
    expect(result?.metadata.files["win-x64"].url).toBeDefined();
  });
});
