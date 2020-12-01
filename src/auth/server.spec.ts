import { ServerResponse } from "http";
import { requestHandler } from "./server";

let requestMock: Partial<ServerRequest>;
let responseMock: Partial<ServerResponse>;

describe("Server", () => {
  beforeEach(() => {
    requestMock = {
      query: ""
    };
    responseMock = {
        getHeaders: jest.fn(),
        writeHead: jest.fn(),
        end: jest.fn(),
      };
  });

  describe("requestHandler()", () => {
    it("does not throw on initialization", () => {
      expect(async () => {
        await requestHandler(requestMock, responseMock as ServerResponse);
      }).not.toThrow();
    });

  });
});
