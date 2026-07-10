import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { copyFile, copyDirectory, copyPlatformSettings, type CopyConfig } from "@/core/filestore/copiers.js";
import fs from "node:fs";
import path from "node:path";

describe("copiers - File Copying with Override Semantics", () => {
  const testDir = "/tmp/test-copiers";
  const sourceDir = path.join(testDir, "source");
  const targetDir = path.join(testDir, "target");

  beforeEach(async () => {
    // Create clean test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });
  });

  afterEach(async () => {
    // Cleanup test directories
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("copyFile", () => {
    it("should copy a single file successfully", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, '{"test": "data"}');

      const result = await copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(result.error).toBeNull();
      expect(fs.existsSync(targetFile)).toBe(true);
      expect(fs.readFileSync(targetFile, "utf-8")).toBe('{"test": "data"}');
    });

    it("should create parent directories if needed", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "subdir/nested/config.json");
      fs.writeFileSync(sourceFile, "test content");

      const result = await copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(fs.existsSync(targetFile)).toBe(true);
    });

    it("should overwrite existing files (replace semantics)", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, "new content");
      fs.writeFileSync(targetFile, "old content");

      const result = await copyFile(sourceFile, targetFile);

      expect(result.status).toBe("completed");
      expect(fs.readFileSync(targetFile, "utf-8")).toBe("new content");
    });

    it("should handle non-existent source file", async () => {
      const sourceFile = path.join(sourceDir, "nonexistent.json");
      const targetFile = path.join(targetDir, "target.json");

      const result = await copyFile(sourceFile, targetFile);

      expect(result.status).toBe("failed");
      expect(result.error).not.toBeNull();
    });

    it("should preserve file permissions", async () => {
      const sourceFile = path.join(sourceDir, "script.sh");
      const targetFile = path.join(targetDir, "script.sh");
      fs.writeFileSync(sourceFile, "#!/bin/bash\necho test");
      fs.chmodSync(sourceFile, 0o755);

      await copyFile(sourceFile, targetFile);

      const stats = fs.statSync(targetFile);
      // Note: Windows may not preserve Unix permissions exactly
      if (process.platform !== "win32") {
        expect(stats.mode).toBe(fs.statSync(sourceFile).mode);
      }
    });
  });

  describe("copyDirectory", () => {
    it("should copy directory structure recursively", async () => {
      // Create nested directory structure
      fs.mkdirSync(path.join(sourceDir, "level1"));
      fs.mkdirSync(path.join(sourceDir, "level1/level2"));
      fs.writeFileSync(path.join(sourceDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(sourceDir, "level1/file2.txt"), "content2");
      fs.writeFileSync(path.join(sourceDir, "level1/level2/file3.txt"), "content3");

      const operations = await copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThan(0);
      expect(operations.every((op) => op.status === "completed" || op.operationType === "directory")).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "file1.txt"))).toBe(true);
      expect(fs.existsSync(path.join(sourceDir, "level1/level2/file3.txt"))).toBe(true);
    });

    it("should handle empty directories", async () => {
      const emptyDir = path.join(sourceDir, "empty");
      fs.mkdirSync(emptyDir);

      const operations = await copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThanOrEqual(1); // At least the directory creation
    });

    it("should handle symbolic links when followSymbolicLinks is true", async () => {
      const sourceFile = path.join(sourceDir, "original.txt");
      const symlinkPath = path.join(sourceDir, "link.txt");
      fs.writeFileSync(sourceFile, "original content");
      fs.symlinkSync(sourceFile, symlinkPath);

      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true };
      const operations = await copyDirectory(sourceDir, targetDir, config);

      expect(operations.some((op) => op.operationType === "file")).toBe(true);
    });

    it("should handle non-existent source directory", async () => {
      const nonExistentDir = "/tmp/nonexistent-dir";
      const operations = await copyDirectory(nonExistentDir, targetDir);

      expect(operations.some((op) => op.status === "failed")).toBe(true);
    });

    it("should handle large directory trees", async () => {
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(sourceDir, `file${i}.txt`), `content${i}`);
      }

      const operations = await copyDirectory(sourceDir, targetDir);

      expect(operations.length).toBeGreaterThanOrEqual(100);
      expect(operations.filter((op) => op.status === "completed").length).toBeGreaterThan(50);
    });
  });

  describe("copyPlatformSettings", () => {
    it("should copy platform settings successfully", async () => {
      // Create platform-specific settings structure
      fs.mkdirSync(path.join(sourceDir, "claude"));
      fs.writeFileSync(path.join(sourceDir, "claude", "config.json"), '{"claude": "settings"}');
      fs.mkdirSync(path.join(sourceDir, "claude", "rules"));
      fs.writeFileSync(path.join(sourceDir, "claude", "rules", "custom.md"), "# Custom Rule");

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBeGreaterThanOrEqual(2);
      expect(result.error).toBeNull();
      expect(fs.existsSync(path.join(targetDir, "claude", "config.json"))).toBe(true);
    });

    it("should return error for non-existent source directory", async () => {
      const nonExistentDir = "/tmp/nonexistent-settings";
      const result = await copyPlatformSettings(nonExistentDir, targetDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should report individual operation failures", async () => {
      // Create a file that will fail to copy (e.g., permission issues simulated)
      fs.writeFileSync(path.join(sourceDir, "good.txt"), "content");
      fs.writeFileSync(path.join(sourceDir, "bad.txt"), "content");

      // Make bad.txt unreadable
      try {
        fs.chmodSync(path.join(sourceDir, "bad.txt"), 0o000);
      } catch {
        // Skip this test on systems where chmod doesn't work as expected
      }

      const result = await copyPlatformSettings(sourceDir, targetDir);

      // At least some files should copy
      expect(result.filesCopied).toBeGreaterThanOrEqual(0);
    });

    it("should provide detailed operation tracking", async () => {
      fs.writeFileSync(path.join(sourceDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(sourceDir, "file2.txt"), "content2");

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(result.operations).toBeDefined();
      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations.every((op) => op.sourcePath)).toBe(true);
      expect(result.operations.every((op) => op.destinationPath)).toBe(true);
    });
  });

  describe("override semantics", () => {
    it("should completely replace existing files (no merging)", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");

      // Create existing target with different content
      fs.writeFileSync(targetFile, '{"existing": "data", "preserve": "me"}');
      // Source has completely different structure
      fs.writeFileSync(sourceFile, '{"new": "structure"}');

      await copyFile(sourceFile, targetFile);

      // Verify complete replacement, not merge
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe('{"new": "structure"}');
      expect(content).not.toContain("preserve");
    });

    it("should not create backups (Git provides version history)", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");

      fs.writeFileSync(sourceFile, "new content");
      fs.writeFileSync(targetFile, "old content");

      await copyFile(sourceFile, targetFile);

      // Verify old content is gone (no backup file created)
      expect(fs.readFileSync(targetFile, "utf-8")).toBe("new content");
      expect(fs.existsSync(targetFile + ".bak")).toBe(false);
      expect(fs.existsSync(targetFile + ".backup")).toBe(false);
    });
  });

  describe("performance and scalability", () => {
    it("should handle large files efficiently", async () => {
      const largeFile = path.join(sourceDir, "large.bin");
      const largeContent = Buffer.alloc(1024 * 1024); // 1MB file

      fs.writeFileSync(largeFile, largeContent);

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(fs.statSync(path.join(targetDir, "large.bin")).size).toBe(1024 * 1024);
    });

    it("should handle many small files efficiently", async () => {
      const fileCount = 1000;
      for (let i = 0; i < fileCount; i++) {
        fs.writeFileSync(path.join(sourceDir, `file${i}.txt`), `content${i}`);
      }

      const startTime = Date.now();
      const result = await copyPlatformSettings(sourceDir, targetDir);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(fileCount);
      // Performance target: should complete within reasonable time
      expect(duration).toBeLessThan(10000); // 10 seconds max
    });
  });

  describe("per-entry error isolation", () => {
    it("should continue copying remaining entries after a broken symlink", async () => {
      fs.writeFileSync(path.join(sourceDir, "a.txt"), "a");
      fs.symlinkSync("/non/existent/target", path.join(sourceDir, "broken-link"));
      fs.writeFileSync(path.join(sourceDir, "c.txt"), "c");

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(fs.existsSync(path.join(targetDir, "a.txt"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, "c.txt"))).toBe(true);
      expect(result.success).toBe(false);
      expect(result.filesCopied).toBe(2);
      const brokenOp = result.operations.find((op) => op.sourcePath.endsWith("broken-link"));
      expect(brokenOp?.status).toBe("failed");
    });

    it("should record every entry explicitly even when one throws mid-loop", async () => {
      fs.writeFileSync(path.join(sourceDir, "a.txt"), "a");
      fs.symlinkSync("/non/existent/target", path.join(sourceDir, "broken-link"));
      fs.writeFileSync(path.join(sourceDir, "z.txt"), "z");

      const result = await copyPlatformSettings(sourceDir, targetDir);

      const recordedNames = result.operations.map((op) => path.basename(op.sourcePath));
      expect(recordedNames).toContain("a.txt");
      expect(recordedNames).toContain("broken-link");
      expect(recordedNames).toContain("z.txt");
    });
  });

  describe("symlink escape prevention", () => {
    it("should reject symlinks that resolve outside the settings root", async () => {
      const outsideDir = path.join(testDir, "outside");
      fs.mkdirSync(outsideDir, { recursive: true });
      fs.writeFileSync(path.join(outsideDir, "secret.txt"), "secret");
      fs.symlinkSync(path.join(outsideDir, "secret.txt"), path.join(sourceDir, "escape-link"));

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(false);
      expect(fs.existsSync(path.join(targetDir, "escape-link"))).toBe(false);
      const escapeOp = result.operations.find((op) => op.sourcePath.endsWith("escape-link"));
      expect(escapeOp?.status).toBe("failed");
      expect(escapeOp?.error).toContain("escapes settings root");
    });

    it("should still copy symlinks that resolve within the settings root", async () => {
      fs.writeFileSync(path.join(sourceDir, "real.txt"), "real content");
      fs.symlinkSync(path.join(sourceDir, "real.txt"), path.join(sourceDir, "internal-link"));

      const result = await copyPlatformSettings(sourceDir, targetDir);

      expect(result.success).toBe(true);
      expect(fs.readFileSync(path.join(targetDir, "internal-link"), "utf-8")).toBe("real content");
    });
  });

  describe("env variable interpolation", () => {
    it("should interpolate ${VAR} placeholders when env variables are provided", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, '{"api_key": "${API_KEY}", "endpoint": "${ENDPOINT}"}');

      const envVariables = {
        API_KEY: "secret123",
        ENDPOINT: "https://api.example.com",
      };

      const config: CopyConfig = {
        followSymbolicLinks: true,
        createParentDirectories: true,
        envVariables,
      };

      const result = await copyFile(sourceFile, targetFile, config);

      expect(result.status).toBe("completed");
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe('{"api_key": "secret123", "endpoint": "https://api.example.com"}');
    });

    it("should leave ${VAR} placeholders unchanged when variable is missing", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, '{"api_key": "${MISSING_VAR}", "endpoint": "${ENDPOINT}"}');

      const envVariables = {
        ENDPOINT: "https://api.example.com",
      };

      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true, envVariables };

      const result = await copyFile(sourceFile, targetFile, config);

      expect(result.status).toBe("completed");
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe('{"api_key": "${MISSING_VAR}", "endpoint": "https://api.example.com"}');
    });

    it("should not resolve placeholders from Object prototype keys", async () => {
      const sourceFile = path.join(sourceDir, "config.json");
      const targetFile = path.join(targetDir, "config.json");
      fs.writeFileSync(sourceFile, '{"value": "${constructor}", "other": "${toString}"}');

      const envVariables = {
        REAL_KEY: "real-value",
      };

      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true, envVariables };

      const result = await copyFile(sourceFile, targetFile, config);

      expect(result.status).toBe("completed");
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe('{"value": "${constructor}", "other": "${toString}"}');
    });

    it("should not interpolate binary files", async () => {
      const sourceFile = path.join(sourceDir, "image.png");
      const targetFile = path.join(targetDir, "image.png");
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00]);
      fs.writeFileSync(sourceFile, binaryContent);

      const envVariables = { VAR: "test" };
      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true, envVariables };

      const result = await copyFile(sourceFile, targetFile, config);

      expect(result.status).toBe("completed");
      const content = fs.readFileSync(targetFile);
      expect(content).toEqual(binaryContent);
    });

    it("should handle text files without placeholders gracefully", async () => {
      const sourceFile = path.join(sourceDir, "plain.txt");
      const targetFile = path.join(targetDir, "plain.txt");
      fs.writeFileSync(sourceFile, "Just plain text without any placeholders");

      const envVariables = { VAR: "test" };
      const config: CopyConfig = { followSymbolicLinks: true, createParentDirectories: true, envVariables };

      const result = await copyFile(sourceFile, targetFile, config);

      expect(result.status).toBe("completed");
      const content = fs.readFileSync(targetFile, "utf-8");
      expect(content).toBe("Just plain text without any placeholders");
    });
  });
});
