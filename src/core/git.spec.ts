import "../../tests/_mocks/fs.js";
import { fs, vol } from "memfs";
import { isGitProject, updateGitIgnore } from "./git.js";

describe("git", () => {
  beforeEach(() => {
    vol.reset();
  });

  // test isGitProject()
  describe("isGitProject()", () => {
    it("should return true if the directory is a git project", async () => {
      vol.fromNestedJSON({
        ".git": {},
      });
      expect(await isGitProject()).toBe(true);
    });

    it("should return false if the directory is a not git project", async () => {
      expect(await isGitProject()).toBe(false);
    });
  });

  // test updateGitIgnore()
  describe("updateGitIgnore()", () => {
    it("should insert new entry in .gitignore if the directory is a git project and contains .gitignore", async () => {
      vol.fromNestedJSON({
        ".git": {},
        ".gitignore": "",
      });
      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(true);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("bar");
    });

    it("should append new entry in .gitignore if the directory is a git project and contains .gitignore", async () => {
      vol.fromNestedJSON({
        ".git": {},
        ".gitignore": "foo",
      });

      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(true);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("foo\nbar");
    });

    it("should not update .gitignore if entry already exists", async () => {
      vol.fromNestedJSON({
        ".git": {},
        ".gitignore": "foo\nbar",
      });

      const didUpdate = await updateGitIgnore("bar");

      expect(didUpdate).toBe(false);
      expect(fs.readFileSync(".gitignore", "utf-8")).toBe("foo\nbar");
    });

    it("should not update .gitignore if it does not exist", async () => {
      const didUpdate = await updateGitIgnore("bar");
      expect(didUpdate).toBe(false);
    });

    it("should not update .gitignore if entry is empty", async () => {
      const didUpdate = await updateGitIgnore("");
      expect(didUpdate).toBe(false);
    });

    it("should not update .gitignore if entry is undefined", async () => {
      const didUpdate = await updateGitIgnore(undefined as any);
      expect(didUpdate).toBe(false);
    });
  });
});
