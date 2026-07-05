import { describe, it, expect, beforeEach } from "bun:test";
import { detectSymlink, findSymlinksInDirectory, filterExternalSymlinks } from "@/core/filestore/symlink-handler.js";
import fs from "node:fs";
import path from "node:path";

describe("symlink-handler - Symbolic Link Detection", () => {
  describe("detectSymlink", () => {
    it("should detect regular files as non-symlinks", () => {
      // Create a temporary test file
      const testFile = "/tmp/test-regular-file.txt";
      fs.writeFileSync(testFile, "test content");

      const result = detectSymlink(testFile, "/tmp");
      expect(result.isSymlink).toBe(false);
      expect(result.targetPath).toBeNull();
      expect(result.targetEscapesProject).toBe(false);
      expect(result.warning).toBeNull();

      // Cleanup
      fs.unlinkSync(testFile);
    });

    it("should detect symbolic links correctly", () => {
      // Create source file and symlink
      const sourceFile = "/tmp/test-source.txt";
      const symlinkPath = "/tmp/test-symlink.txt";
      fs.writeFileSync(sourceFile, "source content");
      fs.symlinkSync(sourceFile, symlinkPath);

      const result = detectSymlink(symlinkPath, "/tmp");
      expect(result.isSymlink).toBe(true);
      expect(result.targetPath).toContain("test-source.txt");
      expect(result.targetEscapesProject).toBe(false);
      expect(result.warning).toBeNull();

      // Cleanup
      fs.unlinkSync(symlinkPath);
      fs.unlinkSync(sourceFile);
    });

    it("should detect symlinks pointing outside project", () => {
      // Create symlink to external location
      const externalPath = "/etc/hosts";
      const symlinkPath = "/tmp/test-external-symlink";
      fs.symlinkSync(externalPath, symlinkPath);

      const result = detectSymlink(symlinkPath, "/tmp");
      expect(result.isSymlink).toBe(true);
      expect(result.targetEscapesProject).toBe(true);
      expect(result.warning).toContain("Symbolic link points outside project");

      // Cleanup
      fs.unlinkSync(symlinkPath);
    });

    it("should handle broken symlinks gracefully", () => {
      // Create symlink to non-existent target
      const symlinkPath = "/tmp/test-broken-symlink";
      if (fs.existsSync(symlinkPath) || fs.lstatSync(symlinkPath, { throwIfNoEntry: false })) {
        fs.unlinkSync(symlinkPath);
      }
      fs.symlinkSync("/non/existent/path", symlinkPath);

      const result = detectSymlink(symlinkPath, "/tmp");
      expect(result.isSymlink).toBe(true); // Still detects it as symlink

      // Cleanup
      fs.unlinkSync(symlinkPath);
    });

    it("should handle non-existent paths gracefully", () => {
      const result = detectSymlink("/non/existent/path", "/tmp");
      expect(result.isSymlink).toBe(false);
      expect(result.targetPath).toBeNull();
      expect(result.targetEscapesProject).toBe(false);
      expect(result.warning).toBeNull();
    });
  });

  describe("findSymlinksInDirectory", () => {
    const testDir = "/tmp/test-symlink-scan";

    beforeEach(() => {
      // Create test directory structure
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      // Create regular files
      fs.writeFileSync(path.join(testDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(testDir, "file2.txt"), "content2");

      // Create subdirectory with files
      const subdir = path.join(testDir, "subdir");
      fs.mkdirSync(subdir);
      fs.writeFileSync(path.join(subdir, "file3.txt"), "content3");

      // Create symlink to internal file
      const internalSymlink = path.join(testDir, "internal-symlink.txt");
      fs.symlinkSync(path.join(testDir, "file1.txt"), internalSymlink);

      // Create symlink to external location
      const externalSymlink = path.join(testDir, "external-symlink.txt");
      fs.symlinkSync("/etc/hosts", externalSymlink);
    });

    it("should find all symlinks in directory", () => {
      const results = findSymlinksInDirectory(testDir, testDir);
      expect(results).toHaveLength(2);

      const internal = results.find((r) => r.warning === null);
      const external = results.find((r) => r.warning !== null);

      expect(internal?.isSymlink).toBe(true);
      expect(external?.isSymlink).toBe(true);
      expect(external?.targetEscapesProject).toBe(true);
    });

    it("should scan subdirectories recursively", () => {
      // Add symlink in subdirectory
      const subdirSymlink = path.join(testDir, "subdir", "subdir-symlink.txt");
      fs.symlinkSync("/etc/passwd", subdirSymlink);

      const results = findSymlinksInDirectory(testDir, testDir);
      expect(results.length).toBeGreaterThanOrEqual(3);

      // Cleanup
      fs.unlinkSync(subdirSymlink);
    });

    it("should handle empty directories", () => {
      const emptyDir = "/tmp/test-empty-dir";
      fs.mkdirSync(emptyDir);

      const results = findSymlinksInDirectory(emptyDir, emptyDir);
      expect(results).toHaveLength(0);

      // Cleanup
      fs.rmdirSync(emptyDir);
    });

    it("should handle directories with only regular files", () => {
      const regularOnlyDir = "/tmp/test-regular-only";
      fs.mkdirSync(regularOnlyDir);
      fs.writeFileSync(path.join(regularOnlyDir, "file.txt"), "content");

      const results = findSymlinksInDirectory(regularOnlyDir, regularOnlyDir);
      expect(results).toHaveLength(0);

      // Cleanup
      fs.unlinkSync(path.join(regularOnlyDir, "file.txt"));
      fs.rmdirSync(regularOnlyDir);
    });
  });

  describe("filterExternalSymlinks", () => {
    it("should filter only symlinks with warnings", () => {
      const results = [
        { isSymlink: true, targetPath: "/internal/file", targetEscapesProject: false, warning: null },
        { isSymlink: true, targetPath: "/external/file", targetEscapesProject: true, warning: "External link" },
        { isSymlink: false, targetPath: null, targetEscapesProject: false, warning: null },
        { isSymlink: true, targetPath: "/another/external", targetEscapesProject: true, warning: "Another external" },
      ];

      const external = filterExternalSymlinks(results);
      expect(external).toHaveLength(2);
      expect(external.every((r) => r.warning !== null)).toBe(true);
    });

    it("should handle empty array", () => {
      const external = filterExternalSymlinks([]);
      expect(external).toHaveLength(0);
    });

    it("should handle array with no external symlinks", () => {
      const results = [
        { isSymlink: true, targetPath: "/internal/file", targetEscapesProject: false, warning: null },
        { isSymlink: false, targetPath: null, targetEscapesProject: false, warning: null },
      ];

      const external = filterExternalSymlinks(results);
      expect(external).toHaveLength(0);
    });

    it("should handle all external symlinks", () => {
      const results = [
        { isSymlink: true, targetPath: "/external/file1", targetEscapesProject: true, warning: "External 1" },
        { isSymlink: true, targetPath: "/external/file2", targetEscapesProject: true, warning: "External 2" },
      ];

      const external = filterExternalSymlinks(results);
      expect(external).toHaveLength(2);
    });
  });
});
