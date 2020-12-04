import mockFs from "mock-fs";
import path from "path";
import { response, validateCookie, getProviderFromCookie, readConfigFile, argv } from "./utils";

describe("Utils", () => {
  beforeEach(() => {
    process.env.DEBUG = "";
    process.argv = [];
  });

  describe('argv()', () => {
    it("process.argv = []", () => {
      process.argv = [];
      expect(argv('--port')).toBe(null);
    });

    it("process.argv = ['--port']", () => {
      process.argv = ['--port'];
      expect(argv('--port')).toBe(true);
      expect(argv('--portxyz')).toBe(false);
    });

    it("process.argv = ['--port=4242']", () => {
      process.argv = ['--port=4242'];
      expect(argv('--port')).toBe("4242");
    });

    it("process.argv = ['--port  =   4242  ']", () => {
      process.argv = ['--port  =  4242  '];
      expect(argv('--port')).toBe("4242");
    });

    it("process.argv = ['--port', '4242']", () => {
      process.argv = ['--port', '4242'];
      expect(argv('--port')).toBe("4242");
    });

    it("process.argv = ['--port', '--other']", () => {
      process.argv = ['--port', '--other'];
      expect(argv('--port')).toBe(true);
    });

    it("process.argv = ['--port=']", () => {
      process.argv = ['--port='];
      expect(argv('--port')).toBe(null);
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
    it("config file not found should return undefined", () => {
      expect(readConfigFile()).toBe(undefined);
    });

    it("config file with wrong filename should return undefined", () => {
      mockFs({
        ".github/workflows/wrong-file-name-pattern.yml": "",
      });

      expect(readConfigFile()).toBe(undefined);

      mockFs.restore();
    });

    it("invalid YAML file should throw", () => {
      mockFs({
        ".github/workflows/azure-static-web-apps__not-valid.yml": "",
      });

      expect(() => readConfigFile()).toThrow(/could not parse the SWA workflow file/);

      mockFs.restore();
    });

    describe("checking workflow properties", () => {
      it("missing property 'jobs' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps__not-valid.yml": `name: Azure Static Web Apps CI/CD`,
        });

        expect(() => readConfigFile()).toThrow(/missing property 'jobs'/);

        mockFs.restore();
      });

      it("missing property 'jobs.build_and_deploy_job' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  invalid_property:
`,
        });
        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job'/);

        mockFs.restore();
      });

      it("missing property 'jobs.build_and_deploy_job.steps' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    invalid_property:
`,
        });

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);

        mockFs.restore();
      });

      it("invalid property 'jobs.build_and_deploy_job.steps' should throw", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
`,
        });
        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps'/);

        mockFs.restore();
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

        expect(() => readConfigFile()).toThrow(/invalid property 'jobs.build_and_deploy_job.steps\[\]'/);

        mockFs.restore();
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

        expect(() => readConfigFile()).toThrow(/missing property 'jobs.build_and_deploy_job.steps\[\].with'/);

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appLocation).toBe(path.normalize(process.cwd() + "/"));

        mockFs.restore();
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
        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appLocation).toBe(path.normalize(process.cwd() + "/"));

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.apiLocation).toBe(path.normalize(process.cwd() + "/api"));

        mockFs.restore();
      });

      it("property 'api_location' should be set to 'api' if missing", () => {
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.apiLocation).toBe(path.normalize(process.cwd() + "/api"));

        mockFs.restore();
      });

      it("property 'app_artifact_location' should be set", () => {
        mockFs({
          ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_artifact_location: "/"
`,
        });

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appArtifactLocation).toBe(path.normalize(process.cwd() + "/"));

        mockFs.restore();
      });

      it("property 'app_artifact_location' should be set to '/' if missing", () => {
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appArtifactLocation).toBe(path.normalize(process.cwd() + "/"));

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appBuildCommand).toBe("echo test");

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.appBuildCommand).toBe("npm run build --if-present");

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.apiBuildCommand).toBe("echo test");

        mockFs.restore();
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

        expect(readConfigFile()).toBeTruthy();
        expect(readConfigFile()?.apiBuildCommand).toBe("npm run build --if-present");

        mockFs.restore();
      });
    });
  });
});
