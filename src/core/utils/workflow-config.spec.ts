jest.mock("../constants", () => {});
import mockFs from "mock-fs";
import path from "path";
import { readWorkflowFile } from "./workflow-config";

describe("readWorkflowFile()", () => {
  afterEach(() => {
    mockFs.restore();
  });

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
    it(`missing property "jobs" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps__not-valid.yml": `name: Azure Static Web Apps CI/CD`,
      });

      expect(() => readWorkflowFile()).toThrow(/missing property "jobs"/);
    });

    it(`missing property "jobs.build_and_deploy_job" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps.yml": `
jobs:
  invalid_property:
`,
      });
      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job"/);
    });

    it(`missing property "jobs.build_and_deploy_job.steps" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    invalid_property:
`,
      });

      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job.steps"/);
    });

    it(`invalid property"jobs.build_and_deploy_job.steps" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
`,
      });
      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job.steps"/);
    });

    it(`invalid property "jobs.build_and_deploy_job.steps[]" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
`,
      });

      expect(() => readWorkflowFile()).toThrow(/invalid property "jobs.build_and_deploy_job.steps\[\]"/);
    });

    it(`missing property "jobs.build_and_deploy_job.steps[].with" should throw`, () => {
      mockFs({
        ".github/workflows/azure-static-web-apps.yml": `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
`,
      });

      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job.steps\[\].with"/);
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
