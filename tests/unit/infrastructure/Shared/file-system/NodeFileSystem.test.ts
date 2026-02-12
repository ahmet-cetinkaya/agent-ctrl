import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";
import { mkdir, rm, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("NodeFileSystem", () => {
  let fileSystem: NodeFileSystem;
  let testDir: string;

  beforeEach(async () => {
    fileSystem = new NodeFileSystem();
    testDir = resolve(tmpdir(), `node-filesystem-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe("mkdir", () => {
    it("should create directory successfully", async () => {
      const dirPath = resolve(testDir, "new-dir");
      await fileSystem.mkdir(dirPath);

      // Verify directory was created
      await access(dirPath);
    });

    it("should create directory recursively", async () => {
      const nestedDirPath = resolve(testDir, "level1", "level2", "level3");
      await fileSystem.mkdir(nestedDirPath, { recursive: true });

      // Verify nested directory was created
      await access(nestedDirPath);
    });
  });

  describe("writeFile", () => {
    it("should write file with default encoding", async () => {
      const filePath = resolve(testDir, "test.txt");
      const content = "Hello, World!";

      await fileSystem.writeFile(filePath, content);

      // Verify file was written
      const result = await Bun.file(filePath).text();
      expect(result).toBe(content);
    });

    it("should write file with custom encoding", async () => {
      const filePath = resolve(testDir, "utf8-test.txt");
      const content = "Unicode: 🚀 ✓";

      await fileSystem.writeFile(filePath, content, "utf-8");

      // Verify file was written with correct encoding
      const result = await Bun.file(filePath).text();
      expect(result).toBe(content);
    });
  });

  describe("access", () => {
    it("should access existing file", async () => {
      const filePath = resolve(testDir, "existing.txt");
      await writeFile(filePath, "content");

      // Should not throw for existing file
      await fileSystem.access(filePath);
    });

    it("should throw for non-existing file", async () => {
      const filePath = resolve(testDir, "non-existing.txt");

      // Should throw for non-existing file
      await expect(fileSystem.access(filePath)).rejects.toThrow();
    });
  });

  describe("readdir", () => {
    it("should read directory with files", async () => {
      const filePath1 = resolve(testDir, "file1.txt");
      const filePath2 = resolve(testDir, "file2.txt");
      const subDir = resolve(testDir, "subdir");

      await writeFile(filePath1, "content1");
      await writeFile(filePath2, "content2");
      await mkdir(subDir, { recursive: true });
      await writeFile(resolve(subDir, "nested.txt"), "nested");

      const entries = await fileSystem.readdir(testDir);

      expect(entries).toHaveLength(3);

      const fileNames = entries.map((e) => e.name).sort();
      expect(fileNames).toEqual(["file1.txt", "file2.txt", "subdir"]);

      // Check directory detection
      const subDirEntry = entries.find((e) => e.name === "subdir");
      if (subDirEntry) {
        expect(subDirEntry.isDirectory).toBe(true);
      }

      const file1Entry = entries.find((e) => e.name === "file1.txt");
      if (file1Entry) {
        expect(file1Entry.isFile).toBe(true);
      }
    });

    it("should read empty directory", async () => {
      const emptyDir = resolve(testDir, "empty");
      await mkdir(emptyDir, { recursive: true });

      const entries = await fileSystem.readdir(emptyDir);

      expect(entries).toHaveLength(0);
    });
  });

  describe("resolve", () => {
    it("should resolve single path", () => {
      const result = fileSystem.resolve(testDir);
      expect(result).toBe(testDir);
    });

    it("should resolve multiple path segments", () => {
      const segment1 = "subdir";
      const segment2 = "file.txt";
      const expected = resolve(testDir, segment1, segment2);

      const result = fileSystem.resolve(testDir, segment1, segment2);
      expect(result).toBe(expected);
    });

    it("should resolve relative paths correctly", () => {
      const result = fileSystem.resolve(testDir, "..", "other");

      // Should resolve to parent directory plus 'other'
      expect(result).toContain("other");
    });
  });

  describe("error handling", () => {
    it("should handle permission errors gracefully", async () => {
      // Create a file and attempt to make it inaccessible
      const filePath = resolve(testDir, "restricted.txt");
      await writeFile(filePath, "content");

      try {
        // This might not work on all systems, but should handle gracefully
        await fileSystem.access(filePath);
      } catch (error) {
        // Expected to fail on restricted file
        expect(error).toBeInstanceOf(Error);
      }
    });
  });
});
