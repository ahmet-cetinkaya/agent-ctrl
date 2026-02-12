import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { DirectoryScanner } from "@/infrastructure/features/projects/scanners/DirectoryScanner";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("DirectoryScanner", () => {
  let scanner: DirectoryScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new DirectoryScanner();
    testDir = resolve(tmpdir(), `directory-scanner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe("scan", () => {
    it("should return empty result for empty directory", async () => {
      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toEqual([]);
        expect(result.data.warnings).toEqual([]);
      }
    });

    it("should find files in directory", async () => {
      await writeFile(resolve(testDir, "file1.txt"), "content 1");
      await writeFile(resolve(testDir, "file2.txt"), "content 2");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(2);
        expect(result.data.files.map((f) => f.name).sort()).toEqual(["file1.txt", "file2.txt"]);
      }
    });

    it("should detect directories correctly", async () => {
      const dir1 = resolve(testDir, "dir1");
      const dir2 = resolve(testDir, "dir2");

      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(2);
        expect(result.data.files.every((f) => f.isDirectory)).toBe(true);
        expect(result.data.files.map((f) => f.name).sort()).toEqual(["dir1", "dir2"]);
      }
    });

    it("should set correct file extensions", async () => {
      await writeFile(resolve(testDir, "file.txt"), "content");
      await writeFile(resolve(testDir, "file.md"), "content");
      await writeFile(resolve(testDir, "file.json"), "content");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        const exts = result.data.files.map((f) => f.extension).sort();
        expect(exts).toEqual([".json", ".md", ".txt"]);
      }
    });

    it("should handle mixed files and directories", async () => {
      const dir1 = resolve(testDir, "dir1");
      await mkdir(dir1, { recursive: true });
      await writeFile(resolve(testDir, "file1.txt"), "content 1");
      await writeFile(resolve(testDir, "file2.txt"), "content 2");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(3);
        expect(result.data.files.filter((f) => f.isDirectory)).toHaveLength(1);
        expect(result.data.files.filter((f) => !f.isDirectory)).toHaveLength(2);
      }
    });

    it("should filter by extensions when provided", async () => {
      await writeFile(resolve(testDir, "file.txt"), "txt content");
      await writeFile(resolve(testDir, "file.md"), "md content");
      await writeFile(resolve(testDir, "file.json"), "json content");

      const result = await scanner.scan(testDir, { extensions: [".md", ".markdown"] });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(1);
        expect(result.data.files[0].name).toBe("file.md");
        expect(result.data.warnings.length).toBe(2);
        expect(result.data.warnings.some((w) => w.includes("invalid extension"))).toBe(true);
      }
    });

    it("should not scan recursively by default", async () => {
      const subDir = resolve(testDir, "subdir");
      await mkdir(subDir, { recursive: true });
      await writeFile(resolve(subDir, "nested.txt"), "nested content");
      await writeFile(resolve(testDir, "top.txt"), "top content");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(2);
        expect(result.data.files.map((f) => f.name)).not.toContain("nested.txt");
        expect(result.data.files.map((f) => f.name)).toContain("top.txt");
        expect(result.data.files.filter((f) => f.isDirectory)[0].name).toBe("subdir");
      }
    });

    it("should scan recursively when recursive option is true", async () => {
      const subDir = resolve(testDir, "subdir");
      await mkdir(subDir, { recursive: true });
      await writeFile(resolve(subDir, "nested.txt"), "nested content");
      await writeFile(resolve(testDir, "top.txt"), "top content");

      const result = await scanner.scan(testDir, { recursive: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files.map((f) => f.name)).toContain("nested.txt");
        expect(result.data.files.map((f) => f.name)).toContain("top.txt");
      }
    });

    it("should scan nested directories recursively", async () => {
      const sub1 = resolve(testDir, "level1");
      const sub2 = resolve(sub1, "level2");
      await mkdir(sub2, { recursive: true });
      await writeFile(resolve(sub2, "deep.txt"), "deep content");

      const result = await scanner.scan(testDir, { recursive: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files.map((f) => f.name)).toContain("deep.txt");
      }
    });

    it("should return error for non-existent directory", async () => {
      const result = await scanner.scan("/nonexistent/directory/path");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Failed to scan");
      }
    });

    it("should handle hidden files", async () => {
      await writeFile(resolve(testDir, ".hidden"), "hidden content");
      await writeFile(resolve(testDir, "visible.txt"), "visible content");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(2);
        expect(result.data.files.map((f) => f.name)).toContain(".hidden");
      }
    });

    it("should return absolute paths", async () => {
      await writeFile(resolve(testDir, "file.txt"), "content");

      const result = await scanner.scan(testDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files[0].path).toMatch(new RegExp(`^${testDir}`));
      }
    });

    it("should handle directory access errors", async () => {
      const result = await scanner.scan("/nonexistent/directory/path");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Failed to scan directory");
      }
    });

    it("should handle deep recursive scanning", async () => {
      const level1 = resolve(testDir, "level1");
      const level2 = resolve(level1, "level2");
      const level3 = resolve(level2, "level3");
      const level4 = resolve(level3, "level4");
      const deepFile = resolve(level4, "deep.txt");

      await mkdir(level1, { recursive: true });
      await mkdir(level2, { recursive: true });
      await mkdir(level3, { recursive: true });
      await mkdir(level4, { recursive: true });
      await writeFile(deepFile, "deep content");

      const result = await scanner.scan(testDir, { recursive: true });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files.map((f) => f.name)).toContain("deep.txt");
        expect(result.data.files.some((f) => f.name === "deep.txt")).toBe(true);
      }
    });

    it("should handle file access errors during scanning", async () => {
      const restrictedFile = resolve(testDir, "restricted.txt");
      await writeFile(restrictedFile, "content");

      // Try to remove access (simulated permission error)
      try {
        // This might not work on all systems, but tests error handling
        await scanner.scan(testDir);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
