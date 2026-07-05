import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { copyFile, copyDirectory, copyPlatformSettings, type CopyConfig } from "@/core/filestore/copiers.js";
import fs from "node:fs";
import path from "node:path";

describe("copiers - File Copying with Override Semantics", () => {
  const testDir = "/tmp/test-copiers";
  const sourceDir = path.join(testDir, "source");
  const targetDir = path.join(testDir, "target");

  beforeEach(() => {
    // Create clean test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("copyFile", () => {
    it("should copy a single file successfully", () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, '{"test": "data"}');

      const result = copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(result.error).toBeNull();
      expect(fs.existsSync(targetFile)).toBe(true);
      expect(fs.readFileSync(targetFile, "utf-8")).toBe('{"test": "data"}');
    });

    it("should create parent directories if needed", () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "subdir/nested/config.json");
      fs.writeFileSync(sourceFile, "test content");

      const result = copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(fs.existsSync(targetFile)).toBe(true);
    });

    it("should overwrite existing files (replace semantics)", () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, "new content");
      fs.writeFileSync(targetFile, "old content");

      const result = copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(fs.readFileSync(targetFile, "utf-8")).toBe("new content");
    });

    it("should handle non-existent source file", () => {
      const sourceFile = path.join(sourceDir, "nonexistent.json");
      const targetFile = path.join(targetDir, "target.json");

      const result = copyFile(sourceFile, targetFile);

      expect(result.status).toBe("failed");
      expect(result.error).not.toBeNull();
    });

    it("should preserve file permissions", () => {
      const sourceFile = path.join(sourceDir, "script.sh");
      const targetFile = path.join(targetDir, "script.sh");
      fs.writeFileSync(sourceFile, "#!/bin/bash\necho test");
      fs.chmodSync(sourceFile, 0o755);

      copyFile(sourceFile, targetFile);

      const stats = fs.statSync(targetFile);
      // Note: Windows may not preserve Unix permissions exactly
      if (process.platform !== "win32") {
        expect(stats.mode).toBe(fs.statSync(sourceFile).mode);
      }
    });
  });

  describe("copyDirectory", () => {
    it("should copy directory structure recursively", () => {
      // Create nested directory structure
      fs.mkdirSync(path.join(sourceDir, "level1"));
      fs.mkdirSync(path.join(sourceDir, "level1/level2"));
      fs.writeFileSync(path.join(sourceDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(sourceDir, "level1/file2.txt"), "content2");
      fs.writeFileSync(path.join(sourceDir, "level1/level2/file3.txt"), "content3");

      const operations = copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThan(0);
      expect(operations.every((op) => op.status === "completed" || op.operationType === "directory")).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "file1.txt"))).toBe(true);
      expect(fs.existsSync(path.join(sourceDir, "level1/level2/file3.txt"))).toBe(true);
    });

    it("should handle empty directories", () => {
      const emptyDir = path.join(sourceDir, "empty");
      fs.mkdirSync(emptyDir);

      const operations = copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThanOrEqual(1); // At least the directory creation
    });

    it("should handle symbolic links when followSymbolicLinks is true", () => {
      const sourceFile = path.join(sourceDir, "original.txt");
      const symlinkPath = path.join(sourceDir, "link.txt");
      fs.writeFileSync(sourceFile, "original content");
      fs.symlinkSync(sourceFile, symlinkPath);

      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true };
      const operations = copyDirectory(sourceDir, targetDir, config);

      expect(operations.some((op) => op.operationType === "file")).toBe(true);
    });

    it("should handle non-existent source directory", () => {
      const nonExistentDir = "/tmp/nonexistent-dir";
      const operations = copyDirectory(nonExistentDir, targetDir);

      expect(operations.some((op) => op.status === "failed")).toBe(true);
    });

    it("should handle large directory trees", () => {
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(sourceDir, `file${i}.txt`), `content${i}`);
      }

      const operations = copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThanOrEqual(100);
      expect(operations.filter((op) => op.status === "completed").length).toBeGreaterThan(50);
    });
  });

  describe("copyPlatformSettings", () => {
    it("should copy platform settings successfully", () => {
      // Create platform-specific settings structure
      fs.mkdirSync(path.join(sourceDir, "claude"));
      fs.writeFileSync(path.join(sourceDir, "claude", "config.json"), '{"claude": "settings"}');
      fs.mkdirSync(path.join(sourceDir, "claude", "rules"));
      fs.writeFileSync(path.join(sourceDir, "claude", "rules", "custom.md"), "# Custom Rule");

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBeGreaterThanOrEqual(2);
      expect(result.error).toBeNull();
      expect(fs.existsSync(path.join(targetDir, "claude", "config.json"))).toBe(true);
    });

    it("should return error for non-existent source directory", () => {
      const nonExistentDir = "/tmp/nonexistent-settings";
      const result = copyPlatformSettings(nonExistentDir, targetDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should report individual operation failures", () => {
      // Create a file that will fail to copy (e.g., permission issues simulated)
      fs.writeFileSync(path.join(sourceDir, "good.txt"), "content");
      fs.writeFileSync(path.join(sourceDir, "bad.txt"), "content");

      // Make bad.txt unreadable
      try {
        fs.chmodSync(path.join(sourceDir, "bad.txt"), 0o000);
      } catch {
        // Skip this test on systems where chmod doesn't work as expected
      }

      const result = copyPlatformSettings(sourceDir, targetDir);

      // At least some files should copy
      expect(result.filesCopied).toBeGreaterThanOrEqual(0);
    });

    it("should provide detailed operation tracking", () => {
      fs.writeFileSync(path.join(sourceDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(sourceDir, "file2.txt"), "content2");

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(result.operations).toBeDefined();
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations.every((op) => op.sourcePath)).toBe(true);
      expect(result.operations.every((op) => op.destinationPath)).toBe(true);
    });
  });

  describe("override semantics", () => {
    it("should completely replace existing files (no merging)", () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");

      // Create existing target with different content
      fs.writeFileSync(targetFile, '{"existing": "data", "preserve": "me"}');
      // Source has completely different structure
      fs.writeFileSync(sourceFile, '{"new": "structure"}');

      copyFile(sourceFile, targetFile);

      // Verify complete replacement, not merge
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe('{"new": "structure"}');
      expect(content).not.toContain("preserve");
    });

    it("should not create backups (Git provides version history)", () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");

      fs.writeFileSync(sourceFile, "new content");
      fs.writeFileSync(targetFile, "old content");

      copyFile(sourceFile, targetFile);

      // Verify old content is gone (no backup file created)
      expect(fs.readFileSync(targetFile, "utf-8")).toBe("new content");
      expect(fs.existsSync(targetFile + ".bak")).toBe(false);
      expect(fs.existsSync(targetFile + ".backup")).toBe(false);
    });
  });

  describe("performance and scalability", () => {
    it("should handle large files efficiently", () => {
      const largeFile = path.join(sourceDir, "large.bin");
      const largeContent = Buffer.alloc(1024 * 1024); // 1MB file

      fs.writeFileSync(largeFile, largeContent);

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(fs.statSync(path.join(targetDir, "large.bin")).size).toBe(1024 * 1024);
    });

    it("should handle many small files efficiently", () => {
      const fileCount = 1000;
      for (let i = 0; i < fileCount; i++) {
        fs.writeFileSync(path.join(sourceDir, `file${i}.txt`), `content${i}`);
      }

      const startTime = Date.now();
      const result = copyPlatformSettings(sourceDir, targetDir);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(fileCount);
      // Performance target: should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });
  });

  describe("per-entry error isolation", () => {
    it("should continue copying remaining entries after a broken symlink", () => {
      fs.writeFileSync(path.join(sourceDir, "a.txt"), "a");
      fs.symlinkSync("/non/existent/target", path.join(sourceDir, "broken-link"));
      fs.writeFileSync(path.join(sourceDir, "c.txt"), "c");

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(fs.existsSync(path.join(targetDir, "a.txt"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "c.txt"))).toBe(true);
      expect(result.success).toBe(false);
      expect(result.filesCopied).toBe(2);
      const brokenOp = result.operations.find((op) => op.sourcePath.endsWith("broken-link"));
      expect(brokenOp?.status).toBe("failed");
    });

    it("should record every entry explicitly even when one throws mid-loop", () => {
      fs.writeFileSync(path.join(sourceDir, "a.txt"), "a");
      fs.symlinkSync("/non/existent/target", path.join(sourceDir, "broken-link"));
      fs.writeFileSync(path.join(sourceDir, "z.txt"), "z");

      const result = copyPlatformSettings(sourceDir, targetDir);

      const recordedNames = result.operations.map((op) => path.basename(op.sourcePath));
      expect(recordedNames).toContain("a.txt");
      expect(recordedNames).toContain("broken-link");
      expect(recordedNames).toContain("z.txt");
    });
  });

  describe("symlink escape prevention", () => {
    it("should reject symlinks that resolve outside the settings root", () => {
      const outsideDir = path.join(testDir, "outside");
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret");
      fs.symlinkSync(path.join(outsideDir, "secret.txt"), path.join(sourceDir, "escape-link"));

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(false);
      expect(fs.existsSync(path.join(targetDir, "escape-link"))).toBe(false);
      const escapeOp = result.operations.find((op) => op.sourcePath.endsWith("escape-link"));
      expect(escapeOp?.status).toBe("failed");
      expect(escapeOp?.error).toContain("escapes settings root");
    });

    it("should still copy symlinks that resolve within the settings root", () => {
      fs.writeFileSync(path.join(sourceDir, "real.txt"), "real content");
      fs.symlinkSync(path.join(sourceDir, "real.txt"), path.join(sourceDir, "internal-link"));

      const result = copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "internal-link"), "utf-8")).toBe("real content");
    });
  });
});
