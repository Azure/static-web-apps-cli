import fs from "fs";
import mockFs from "mock-fs";
import { isGitProject, updateGitIgnore } from "./git";

describe("git", () => {
  beforeEach(() => {
    mockFs({});
  });

  afterEach(() => {
    mockFs.restore();
  });

  // test isGitProject()
  describe("isGitProject()", () => {
    it("should return true if the directory is a git project", async () => {
      mockFs({
        ".git": {},
      });
      expect(await isGitProject()).toBe(true);
    });

    it("should return false if the directory is a not git project", async () => {
      mockFs();
      expect(await isGitProject()).toBe(false);
    });
  });

  // test updateGitIgnore()
  describe("updateGitIgnore()", () => {
    it("should insert new entry in .gitignore if the directory is a git project and contains .gitignore", async () => {
      mockFs({
        ".git": {},
        ".gitignore": "",
      });
      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(true);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("bar");
    });

    it("should append new entry in .gitignore if the directory is a git project and contains .gitignore", async () => {
      mockFs({
        ".git": {},
        ".gitignore": "foo",
      });

      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(true);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("foo\nbar");
    });

    it("should not update .gitignore if entry already exists", async () => {
      mockFs({
        ".git": {},
        ".gitignore": "foo\nbar",
      });

      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(false);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("foo\nbar");
    });

    it("should not update .gitignore if it does not exist", async () => {
      mockFs();
      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(false);
    });

    it("should not update .gitignore if entry is empty", async () => {
      mockFs();
      const didUpdate = await updateGitIgnore("");

      expect(didUpdate).toBe(false);
    });

    it("should not update .gitignore if entry is undefined", async () => {
      mockFs();
      const didUpdate = await updateGitIgnore(undefined as any);

      expect(didUpdate).toBe(false);
    });
  });
});
