import mockFs from "mock-fs";
import { detectRuntime, RuntimeType } from "./runtimes";

const appLocation = "/tmp";
describe("runtime", () => {
  afterEach(() => {
    mockFs.restore();
  });

  describe("detectRuntime()", () => {
    it(`should detect ${RuntimeType.dotnet} runtime`, () => {
      mockFs({
        [appLocation]: { "Example.csproj": `<?xml version="1.0" encoding="utf-8"?>` },
      });
      const runtime = detectRuntime(appLocation);

      expect(runtime).toBe(RuntimeType.dotnet);
    });

    it(`should detect ${RuntimeType.node} runtime`, () => {
      mockFs({
        [appLocation]: {
          "package.json": "{}",
        },
      });

      const runtime = detectRuntime(appLocation);
      expect(runtime).toBe(RuntimeType.node);
    });

    it(`should detect ${RuntimeType.unknown} runtime`, () => {
      mockFs({
        [appLocation]: {},
      });
      const runtime = detectRuntime(appLocation);
      mockFs.restore();
      expect(runtime).toBe(RuntimeType.unknown);
    });

    it(`should throw if appLocation is undefined`, () => {
      const runtime = detectRuntime(undefined);
      expect(runtime).toBe(RuntimeType.unknown);
    });
  });
});
