import mockFs from "mock-fs";
import path from "path";
import { address, argv, findSWAConfigFile, logger, parsePort, readWorkflowFile, response, traverseFolder, validateCookie } from "./utils";

describe("Utils", () => {
  const mockLoggerError = jest.spyOn(logger, "error").mockImplementation(() => {
    return undefined as never;
  });

  beforeEach(() => {
    process.env.SWA_CLI_DEBUG = "";
    process.argv = [];
  });

  afterEach(() => {
    mockFs.restore();
  });

  describe("argv()", () => {
    it("process.argv = []", () => {
      process.argv = [];
      expect(argv("--port")).toBe(null);
    });

    it("process.argv = ['--port']", () => {
      process.argv = ["--port"];
      expect(argv("--port")).toBe(true);
      expect(argv("--portxyz")).toBe(false);
    });

    it("process.argv = ['--port=4242']", () => {
      process.argv = ["--port=4242"];
      expect(argv("--port")).toBe("4242");
    });

    it("process.argv = ['--port  =   4242  ']", () => {
      process.argv = ["--port  =  4242  "];
      expect(argv("--port")).toBe("4242");
    });

    it("process.argv = ['--port', '4242']", () => {
      process.argv = ["--port", "4242"];
      expect(argv("--port")).toBe("4242");
    });

    it("process.argv = ['--port', '--other']", () => {
      process.argv = ["--port", "--other"];
      expect(argv("--port")).toBe(true);
    });

    it("process.argv = ['--port=']", () => {
      process.argv = ["--port="];
      expect(argv("--port")).toBe(null);
    });
  });

  describe("response()", () => {
    it("context = null", () => {
      expect(() => {
        response({
          context: null,
        });
      }).toThrow();
    });
    it("context.bindingData = {foo:bar}", () => {
      expect(
        response({
          status: 200,
          context: {
            bindingData: {
              foo: "bar",
            },
          },
        })
      ).toEqual({
        body: null,
        cookies: undefined,
        headers: { "Content-Type": "application/json", status: 200 },
        status: 200,
      });
    });

    it("status = null", () => {
      expect(() => {
        response({
          context: {
            bindingData: {},
          },
          status: null,
        });
      }).toThrow(/TypeError/);
    });

    it("status = 200", () => {
      const res = response({
        context: {
          bindingData: {},
        },
        status: 200,
      });
      expect(res.status).toBe(200);
      expect(res.headers.status).toBe(200);
    });

    it("body = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: null,
      });
      expect(res.body).toBe(null);
    });

    it("body = {foo:bar}", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: {
          foo: "bar",
        },
      });
      expect(typeof res.body).toBe("object");
      expect(res.body.foo).toBeDefined();
      expect(res.body.foo).toBe("bar");
    });

    it("body = {foo:bar} (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: {
          foo: "bar",
        },
      });
      expect(typeof res.body).toBe("object");
      expect(res.body.foo).toBeDefined();
      expect(res.body.foo).toBe("bar");
    });

    it("headers = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: null,
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = null (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: null,
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { foo: bar }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          foo: "bar",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.foo).toBe("bar");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { foo: bar } (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          foo: "bar",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.foo).toBe("bar");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: null }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: null,
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe(null);
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: null } (DEBUG on)", () => {
      process.env.SWA_CLI_DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: null,
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe(null);
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("headers = { location: 'wassim.dev' }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        headers: {
          location: "wassim.dev",
        },
      });
      expect(res.headers).toBeDefined();
      expect(res.headers.location).toBe("wassim.dev");
      expect(res.headers.status).toBe(200);
      expect(res.headers["Content-Type"]).toBe("application/json");
    });

    it("cookies = null", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        cookies: null,
      });

      expect(res.cookies).toBe(null);
    });

    it("cookies = { foo:bar }", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        cookies: {
          foo: "bar",
        },
      });
      expect(res.cookies).toBeDefined();
      expect(res.cookies!.foo).toBe("bar");
    });
  });

  describe("validateCookie()", () => {
    it("cookies = ''", () => {
      expect(validateCookie("")).toBe(false);
    });

    it("cookies = 'abc'", () => {
      expect(validateCookie("")).toBe(false);
    });

    it("cookies = 'foo=bar'", () => {
      expect(validateCookie("foo=bar")).toBe(false);
    });
  });

  describe("readWorkflowFile()", () => {
    it("config file not found should return undefined", () => {
      expect(readWorkflowFile()).toBe(undefined);
    });

    it("config file with wrong filename should return undefined", () => {
      mockFs({
        ".github/workflows/wrong-file-name-pattern.yml": "",
      });

      expect(readWorkflowFile()).toBe(undefined);
    });

    it("invalid YAML file should throw", () => {
      mockFs({
        ".github/workflows/azure-static-web-apps__not-valid.yml": "",
      });

      expect(() => readWorkflowFile()).toThrow(/could not parse the SWA workflow file/);
    });

    describe("checking workflow properties", () => {
      it("missing property 'jobs' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps__not-valid.yml": `name: Azure Static Web Apps CI/CD`,
        });

        expect(() => readWorkflowFile()).toThrow(/missing property 'jobs'/);
      });

      it("missing property 'jobs.build_and_deploy_job' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  invalid_property:
`,
        });
        expect(() => readWorkflowFile()).toThrow(/missing property 'jobs.build_and_deploy_job'/);
      });

      it("missing property 'jobs.build_and_deploy_job.steps' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    invalid_property:
`,
        });

        expect(() => readWorkflowFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);
      });

      it("invalid property 'jobs.build_and_deploy_job.steps' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
`,
        });
        expect(() => readWorkflowFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);
      });

      it("invalid property 'jobs.build_and_deploy_job.steps[]' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
`,
        });

        expect(() => readWorkflowFile()).toThrow(/invalid property 'jobs.build_and_deploy_job.steps\[\]'/);
      });

      it("missing property 'jobs.build_and_deploy_job.steps[].with' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
`,
        });

        expect(() => readWorkflowFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps\[\].with'/);
      });
    });

    describe("checking SWA properties", () => {
      it("property 'app_location' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_location: "/"
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.appLocation).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'app_location' should be set to '/' if missing", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
        });
        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.appLocation).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'api_location' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_location: "/api"
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.apiLocation).toBe(path.normalize(process.cwd() + "/api"));
      });

      it("property 'api_location' should be undefined if missing", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.apiLocation).toBeUndefined();
      });

      it("property 'output_location' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          output_location: "/"
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.outputLocation).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'output_location' should be set to '/' if missing", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.outputLocation).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'app_build_command' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_build_command: "echo test"
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.appBuildCommand).toBe("echo test");
      });

      it("property 'app_build_command' should be set to default if missing", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.appBuildCommand).toBe("npm run build --if-present");
      });

      it("property 'api_build_command' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_build_command: "echo test"
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.apiBuildCommand).toBe("echo test");
      });

      it("property 'api_build_command' should be set to default if missing", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
        });

        expect(readWorkflowFile()).toBeTruthy();
        expect(readWorkflowFile()?.apiBuildCommand).toBe("npm run build --if-present");
      });
    });
  });

  describe("parsePort()", () => {
    it("Ports below 1024 should be invalid", () => {
      parsePort("0");
      expect(mockLoggerError).toBeCalled();
    });
    it("Ports above 49151 should be invalid", () => {
      parsePort("98765");
      expect(mockLoggerError).toBeCalled();
    });
    it("Non-number ports should be invalid", () => {
      parsePort("not a number");
      expect(mockLoggerError).toBeCalled();
    });
    it("Ports between 1024 - 49151 should be valid", () => {
      const port = parsePort("1984");
      expect(port).toBe(1984);
    });
  });

  describe("traverseFolder()", () => {
    const asyncGeneratorToArray = async (gen: AsyncGenerator<string, string, unknown>) => {
      const entries: string[] = [];
      for await (const entry of gen) {
        entries.push(entry);
      }
      return entries;
    };

    it("should handle empty folders", async () => {
      mockFs();

      const entry = await asyncGeneratorToArray(traverseFolder("."));
      expect(entry).toEqual([]);
    });

    describe("should handle flat folder", async () => {
      it("with single entry", async () => {
        mockFs({
          "foo.txt": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(1);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
      });

      it("with multiple entries", async () => {
        mockFs({
          "foo.txt": "fake content",
          "bar.jpg": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(2);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toEndWith("bar.jpg");
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
      });
    });

    describe("should handle deep folders", async () => {
      it("with single entry", async () => {
        mockFs({
          swa: {
            "foo.txt": "fake content",
          },
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(1);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toEndWith(`swa${path.sep}foo.txt`);
      });

      it("with multiple entries", async () => {
        mockFs({
          swa: {
            "foo.txt": "fake content",
          },
          "bar.jpg": "fake content",
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));
        expect(entries.length).toBe(2);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith("bar.jpg"))).toEndWith("bar.jpg");
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}foo.txt`))).toEndWith(`swa${path.sep}foo.txt`);
      });
    });

    describe("should exclude folders", async () => {
      it("node_modules", async () => {
        mockFs({
          "foo.txt": "fake content",
          swa: {
            "bar.jpg": "fake content",
          },
          node_modules: {
            "bar.txt": "fake content",
          },
        });

        const entries = await asyncGeneratorToArray(traverseFolder("."));

        expect(entries.length).toBe(2);

        // entries are populated indeterminately because of async generator
        expect(entries.find((entry) => entry.endsWith(`swa${path.sep}bar.jpg`))).toEndWith(`swa${path.sep}bar.jpg`);
        expect(entries.find((entry) => entry.endsWith("foo.txt"))).toEndWith("foo.txt");
      });
    });
  });

  describe("findSWAConfigFile()", () => {
    it("should find no config file", async () => {
      mockFs({});

      const file = await findSWAConfigFile(".");
      expect(file).toBe(null);
    });

    it("should find staticwebapp.config.json (at the root)", async () => {
      mockFs({
        "staticwebapp.config.json": `{ "routes": []}`,
      });

      const config = await findSWAConfigFile(".");
      expect(config?.file).toContain("staticwebapp.config.json");
    });

    it("should find staticwebapp.config.json (recursively)", async () => {
      mockFs({
        s: {
          w: {
            a: {
              "staticwebapp.config.json": `{ "routes": []}`,
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config?.file).toContain("staticwebapp.config.json");
    });

    it("should find routes.json (at the root)", async () => {
      mockFs({
        "routes.json": `{ "routes": []}`,
      });

      const config = await findSWAConfigFile(".");
      expect(config?.file).toContain("routes.json");
    });

    it("should find routes.json (recursively)", async () => {
      mockFs({
        s: {
          w: {
            a: {
              "routes.json": `{ "routes": []}`,
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config?.file).toContain("routes.json");
    });

    it("should ignore routes.json if a staticwebapp.config.json exists", async () => {
      mockFs({
        s: {
          w: {
            "staticwebapp.config.json": `{ "routes": []}`,
            a: {
              "routes.json": `{ "routes": []}`,
            },
          },
        },
      });

      const config = await findSWAConfigFile(".");
      expect(config?.file).toContain("staticwebapp.config.json");
    });
  });

  describe("address()", () => {
    it("should throw for malformed URI", () => {
      expect(() => address("", undefined)).toThrowError(/is not set/);
      expect(() => address("", 80)).toThrowError(/is not set/);
      expect(() => address("¬˚˜∆˙¨√√†®ç†®∂œƒçƒ∂ß®´ß`®´£¢´®¨¥†øˆ¨ø(*&*ˆ%&ˆ%$#%@!", 80)).toThrowError(/malformed/);
      expect(() => address("123.45.43.56234", undefined)).toThrowError(/malformed/);
    });

    it("should handle valid URIs", () => {
      expect(address("foo", undefined)).toBe("http://foo");
      expect(address("foo.com", undefined)).toBe("http://foo.com");
      expect(address("foo.com", 80)).toBe("http://foo.com:80");
      expect(address("foo.bar.com", 80)).toBe("http://foo.bar.com:80");
      expect(address("foo.com", "4200")).toBe("http://foo.com:4200");
      expect(address("127.0.0.1", "4200")).toBe("http://127.0.0.1:4200");
      expect(address("127.0.0.1", "4200")).toBe("http://127.0.0.1:4200");
      expect(address("[::1]", "4200")).toBe("http://[::1]:4200");
    });

    it("should accept protocol both HTTP and HTTPS protocols", () => {
      expect(address("127.0.0.1", "4200", "http")).toBe("http://127.0.0.1:4200");
      expect(address("127.0.0.1", "4200", "https")).toBe("https://127.0.0.1:4200");
    });
  });
});
