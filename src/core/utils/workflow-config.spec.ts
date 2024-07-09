import "../../../tests/_mocks/fs.js";
import { vol } from "memfs";

vi.mock("../constants", () => {
  return {};
});

import path from "path";
import { MockInstance } from "vitest";
import { convertToNativePaths } from "../../test.helpers.js";
import { readWorkflowFile } from "./workflow-config.js";

vi.mock("../../config", () => {
  return {
    DEFAULT_CONFIG: {
      appLocation: convertToNativePaths("/"),
      outputLocation: convertToNativePaths("/baz"),
      appBuildCommand: "npm run foobar",
      apiBuildCommand: "npm run foobar",
    },
  };
});

describe("readWorkflowFile()", () => {
  let processSpy: MockInstance<(this: string) => string>;

  beforeEach(() => {
    processSpy = vi.spyOn(process, "cwd").mockReturnValue(convertToNativePaths("/ABSOLUTE_PATH"));
    vol.reset();
  });

  it("config file not found should return undefined", () => {
    expect(readWorkflowFile()).toBe(undefined);
  });

  it("config file with wrong filename should return undefined", () => {
    vol.fromJSON({
      [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/wrong-file-name-pattern.yml")]: "",
    });

    expect(readWorkflowFile()).toBe(undefined);
  });

  it("invalid YAML file should throw", () => {
    vol.fromJSON({
      [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps__not-valid.yml")]: "",
    });

    expect(() => readWorkflowFile()).toThrow(/could not parse the SWA workflow file/);
  });

  describe("checking workflow properties", () => {
    it(`missing property "jobs" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps__not-valid.yml")]: `name: Azure Static Web Apps CI/CD`,
      });

      expect(() => readWorkflowFile()).toThrow(/missing property "jobs"/);
    });

    it(`missing property "jobs.build_and_deploy_job" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  invalid_property:
`,
      });
      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job"/);
    });

    it(`missing property "jobs.build_and_deploy_job.steps" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    invalid_property:
`,
      });

      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job.steps"/);
    });

    it(`invalid property"jobs.build_and_deploy_job.steps" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
`,
      });
      expect(() => readWorkflowFile()).toThrow(/missing property "jobs.build_and_deploy_job.steps"/);
    });

    it(`invalid property "jobs.build_and_deploy_job.steps[]" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
`,
      });

      expect(() => readWorkflowFile()).toThrow(/invalid property "jobs.build_and_deploy_job.steps\[\]"/);
    });

    it(`missing property "jobs.build_and_deploy_job.steps[].with" should throw`, () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
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
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_location: "/"
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.appLocation).toBe(path.normalize(convertToNativePaths("/ABSOLUTE_PATH/")));
    });

    it("property 'app_location' should be set to '/' if missing", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.appLocation).toBe(convertToNativePaths("/ABSOLUTE_PATH/"));
    });

    it("property 'api_location' should be set", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_location: "/api"
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.apiLocation).toBe(path.normalize(convertToNativePaths("/ABSOLUTE_PATH/api")));
    });

    it("property 'api_location' should be undefined if missing", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.apiLocation).toBeUndefined();
    });

    it("property 'output_location' should be set", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          output_location: "/"
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.outputLocation).toBe(convertToNativePaths("/ABSOLUTE_PATH/"));
    });

    it("property 'output_location' should be set to default if missing", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.outputLocation).toBe(convertToNativePaths("/ABSOLUTE_PATH/baz"));
    });

    it("property 'app_build_command' should be set", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          app_build_command: "echo test"
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.appBuildCommand).toBe("echo test");
    });

    it("property 'app_build_command' should be set to default if missing", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.appBuildCommand).toBe("npm run foobar");
    });

    it("property 'api_build_command' should be set", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          api_build_command: "echo test"
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.apiBuildCommand).toBe("echo test");
    });

    it("property 'api_build_command' should be set to default if missing", () => {
      vol.fromJSON({
        [convertToNativePaths("/ABSOLUTE_PATH/.github/workflows/azure-static-web-apps.yml")]: `
jobs:
  build_and_deploy_job:
    steps:
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v0.0.1-preview
        with:
          foo: bar
`,
      });

      const workflow = readWorkflowFile();

      expect(workflow).toBeTruthy();
      expect(workflow?.apiBuildCommand).toBe("npm run foobar");
    });
  });
});
