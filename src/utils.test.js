const fs = require("fs");
const path = require("path");
const { Volume } = require("memfs");
const shell = require("shelljs");

const { response, validateCookie, getProviderFromCookie, readConfigFile } = require("./utils");

// mock fs
jest.mock(`fs`, () => {
  const fs = jest.requireActual(`fs`);
  const unionfs = require(`unionfs`).default;
  unionfs.reset = () => {
    unionfs.fss = [fs];
  };
  return unionfs.use(fs);
});

describe("Utils", () => {
  beforeEach(() => {
    delete process.env.DEBUG;
  });

  afterEach(() => {
    fs.reset();
  });

  describe("response()", () => {
    it("context = null", () => {
      expect(() => {
        response({
          context: null,
        });
      }).toThrow();
    });
    it("context.bindingData = null", () => {
      expect(() =>
        response({
          status: 200,
          context: {
            bindingData: null,
          },
        })
      ).toThrow();
    });
    it("context.bindingData = {foo:bar} (DEBUG off)", () => {
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
    it("context.bindingData = {foo:bar} (DEBUG on)", () => {
      process.env.DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {
            foo: "bar",
          },
        },
      });
      expect(typeof res.body).toBe("string");
      expect(JSON.parse(res.body).debug).toBeDefined();
      expect(JSON.parse(res.body).debug.context).toBeDefined();
      expect(JSON.parse(res.body).debug.context.foo).toBe("bar");
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

    it("body = null (DEBUG off)", () => {
      const res = response({
        status: 200,
        context: {
          bindingData: {},
        },
        body: null,
      });
      expect(res.body).toBe(null);
    });

    it("body = null (DEBUG on)", () => {
      process.env.DEBUG = "*";

      const res = response({
        status: 200,
        context: {
          bindingData: {
            foo: "bar",
          },
        },
        body: null,
      });
      expect(typeof res.body).toBe("string");
      expect(JSON.parse(res.body).debug).toBeDefined();
      expect(JSON.parse(res.body).debug.context).toBeDefined();
      expect(JSON.parse(res.body).debug.context.foo).toBe("bar");
    });

    it("body = {foo:bar} (DEBUG off)", () => {
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
      process.env.DEBUG = "*";

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

    it("headers = null (DEBUG off)", () => {
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
      process.env.DEBUG = "*";

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

    it("headers = { foo: bar } (DEBUG off)", () => {
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
      process.env.DEBUG = "*";

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

    it("headers = { location: null } (DEBUG off)", () => {
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
      process.env.DEBUG = "*";

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

    it("headers = { location: 'wassim.dev' } (DEBUG off)", () => {
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

    it("headers = { location: 'wassim.dev' } (DEBUG on)", () => {
      process.env.DEBUG = "*";

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
      expect(res.headers.location).toBe(null);
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
      expect(res.cookies.foo).toBe("bar");
    });
  });

  describe("validateCookie()", () => {
    it("cookies = null", () => {
      expect(() => {
        validateCookie(null);
      }).toThrow(/TypeError/);
    });

    it("cookies = undefined", () => {
      expect(() => {
        validateCookie(undefined);
      }).toThrow(/TypeError/);
    });

    it("cookies = 123", () => {
      expect(() => {
        validateCookie(123);
      }).toThrow(/TypeError/);
    });

    it("cookies = {}", () => {
      expect(() => {
        validateCookie({});
      }).toThrow(/TypeError/);
    });

    it("cookies = ''", () => {
      expect(validateCookie("")).toBe(false);
    });

    it("cookies = 'abc'", () => {
      expect(validateCookie("")).toBe(false);
    });

    it("cookies = 'foo=bar'", () => {
      expect(validateCookie("foo=bar")).toBe(false);
    });

    it("cookies = 'StaticWebAppsAuthCookie=abc123' and process.env.StaticWebAppsAuthCookie = undefined", () => {
      delete process.env.StaticWebAppsAuthCookie;
      expect(validateCookie("StaticWebAppsAuthCookie=abc123")).toBe(false);
    });

    it("cookies = 'StaticWebAppsAuthCookie=abc123' and process.env.StaticWebAppsAuthCookie = 'xyz'", () => {
      process.env.StaticWebAppsAuthCookie = "xyz";
      expect(validateCookie("StaticWebAppsAuthCookie=abc123")).toBe(false);
    });

    it("cookies = 'StaticWebAppsAuthCookie=abc123' and process.env.StaticWebAppsAuthCookie = 'abc123'", () => {
      process.env.StaticWebAppsAuthCookie = "abc123";
      expect(validateCookie("StaticWebAppsAuthCookie=abc123")).toBe(true);
    });

    it("cookies = 'StaticWebAppsAuthCookie=xyz' and process.env.StaticWebAppsAuthCookie = 'abc123'", () => {
      process.env.StaticWebAppsAuthCookie = "abc123";
      expect(validateCookie("StaticWebAppsAuthCookie=xyz")).toBe(false);
    });

    it("cookies = 'StaticWebAppsAuthCookie=abc123;foo=bar' and process.env.StaticWebAppsAuthCookie = 'abc123'", () => {
      process.env.StaticWebAppsAuthCookie = "abc123";
      expect(validateCookie("StaticWebAppsAuthCookie=abc123;foo=bar")).toBe(true);
    });
  });

  describe("getProviderFromCookie()", () => {
    it("cookies = null", () => {
      expect(() => {
        getProviderFromCookie(null);
      }).toThrow(/TypeError/);
    });

    it("cookies = undefined", () => {
      expect(() => {
        getProviderFromCookie(undefined);
      }).toThrow(/TypeError/);
    });

    it("cookies = 123", () => {
      expect(() => {
        getProviderFromCookie(123);
      }).toThrow(/TypeError/);
    });

    it("cookies = {}", () => {
      expect(() => {
        getProviderFromCookie({});
      }).toThrow(/TypeError/);
    });

    it("cookies = foo=bar", () => {
      expect(getProviderFromCookie("foo=bar")).toBe(undefined);
    });

    it("cookies = StaticWebAppsAuthCookie__PROVIDER", () => {
      expect(getProviderFromCookie("StaticWebAppsAuthCookie__PROVIDER")).toBe(undefined);
    });

    it("cookies = StaticWebAppsAuthCookie__PROVIDER=github", () => {
      expect(getProviderFromCookie("StaticWebAppsAuthCookie__PROVIDER=github")).toBe("github");
    });
  });

  describe("readConfigFile()", () => {
    it("config file not found should throw", () => {
      const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
      expect(() => readConfigFile()).toThrow(/TypeError: GitHub action file content should be a string/);
    });

    it("config file not found should process.exit(0)", () => {
      const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});

      // we know this will throw. Check previous test
      try {
        readConfigFile();
      } catch (error) {}

      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("config file with wrong filename should process.exit(0)", () => {
      const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
      fs.use(
        Volume.fromJSON(
          {
            "wrong-file-name-pattern.yml": "",
          },
          ".github/workflows"
        )
      );

      expect(() => readConfigFile()).toThrow(/TypeError: GitHub action file content should be a string/);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    it("invalid YAML file should throw", () => {
      const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
      fs.use(
        Volume.fromJSON(
          {
            "azure-static-web-apps__not-valid.yml": "",
          },
          ".github/workflows"
        )
      );

      expect(() => readConfigFile()).toThrow(/could not parse the SWA workflow file/);
      expect(mockExit).toHaveBeenCalledWith(0);
    });

    describe("checking workflow properties", () => {
      it("missing property 'jobs' should throw", () => {
        const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps__not-valid.yml": `name: Azure Static Web Apps CI/CD`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/missing property 'jobs'/);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      it("missing property 'jobs.build_and_deploy_job' should throw", () => {
        const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  invalid_property:
`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job'/);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      it("missing property 'jobs.build_and_deploy_job.steps' should throw", () => {
        const mockExit = jest.spyOn(shell, "exit").mockImplementation(() => {});
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    invalid_property:
`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);
        expect(mockExit).toHaveBeenCalledWith(0);
      });

      it("invalid property 'jobs.build_and_deploy_job.steps' should throw", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);
      });

      it("invalid property 'jobs.build_and_deploy_job.steps[]' should throw", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/invalid property 'jobs.build_and_deploy_job.steps\[\]'/);
      });

      it("missing property 'jobs.build_and_deploy_job.steps[].with' should throw", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
`,
            },
            ".github/workflows"
          )
        );

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps\[\].with'/);
      });
    });

    describe("checking SWA properties", () => {
      it("property 'app_location' should be set", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_location: "/"
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_location).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'app_location' should be set to '/' if missing", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_location).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'api_location' should be set", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_location: "/api"
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().api_location).toBe(path.normalize(process.cwd() + "/api"));
      });

      it("property 'api_location' should be set to 'api' if missing", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().api_location).toBe(path.normalize(process.cwd() + "/api"));
      });

      it("property 'app_artifact_location' should be set", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_artifact_location: "/"
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_artifact_location).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'app_artifact_location' should be set to '/' if missing", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_artifact_location).toBe(path.normalize(process.cwd() + "/"));
      });

      it("property 'app_build_command' should be set", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_build_command: "echo test"
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_build_command).toBe("echo test");
      });

      it("property 'app_build_command' should be set to default if missing", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().app_build_command).toBe("npm run build --if-present");
      });

      it("property 'api_build_command' should be set", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_build_command: "echo test"
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().api_build_command).toBe("echo test");
      });

      it("property 'api_build_command' should be set to default if missing", () => {
        fs.use(
          Volume.fromJSON(
            {
              "azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
            },
            ".github/workflows"
          )
        );

        expect(readConfigFile().api_build_command).toBe("npm run build --if-present");
      });
    });
  });
});
