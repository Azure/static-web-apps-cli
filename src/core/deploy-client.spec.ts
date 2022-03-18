jest.mock("node-fetch", () => jest.fn());

import { fetchLatestClientVersionDefinition } from "./deploy-client";

function mockResponse(response: any, status = 200) {
  const fetchMock = jest.requireMock("node-fetch");
  fetchMock.mockImplementationOnce(() =>
    Promise.resolve({
      status,
      json: () => Promise.resolve(response),
    })
  );
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
