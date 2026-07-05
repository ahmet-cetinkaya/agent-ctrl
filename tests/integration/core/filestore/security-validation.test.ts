import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  validateFilePath,
  validateMultiplePaths,
  validateDirectory,
  type SecurityValidationConfig,
} from "@/core/filestore/security-service.js";
import fs from "node:fs";
import path from "node:path";

describe("Security Validation Integration Tests", () => {
  const testDir = "/tmp/test-security-validation";

  beforeEach(() => {
    // Create clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("validateFilePath - real filesystem operations", () => {
    it("should validate safe file paths in project settings", () => {
      const settingsFile = path.join(testDir, "settings", "claude", "config.json");
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.writeFileSync(settingsFile, '{"test": "data"}');

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath(settingsFile, config);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.validationContext.hasSymbolicLinks).toBe(false);
    });

    it("should detect and reject path traversal attempts", () => {
      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath("../../../etc/passwd", config);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Path traversal");
    });

    it("should handle symbolic links with warnings", () => {
      const settingsFile = path.join(testDir, "settings", "claude", "config.json");
      const externalTarget = "/etc/hosts";
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.symlinkSync(externalTarget, settingsFile);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath(settingsFile, config);

      expect(result.isValid).toBe(true); // Warning mode by default
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Symbolic link points outside project");

      fs.unlinkSync(settingsFile);
    });

    it("should fail on external symlinks when configured to do so", () => {
      const settingsFile = path.join(testDir, "settings", "claude", "config.json");
      const externalTarget = "/etc/hosts";
      fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
      fs.symlinkSync(externalTarget, settingsFile);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: true,
      };
      const result = validateFilePath(settingsFile, config);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("External symbolic link");

      fs.unlinkSync(settingsFile);
    });

    it("should handle internal symlinks without warnings", () => {
      const targetFile = path.join(testDir, "internal", "config.json");
      const linkFile = path.join(testDir, "settings", "link.json");
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.mkdirSync(path.dirname(linkFile), { recursive: true });
      fs.writeFileSync(targetFile, '{"internal": true}');
      fs.symlinkSync(targetFile, linkFile);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath(linkFile, config);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBe(0);

      fs.unlinkSync(linkFile);
      fs.unlinkSync(targetFile);
    });
  });

  describe("validateMultiplePaths - batch security validation", () => {
    it("should validate multiple paths with mixed safety levels", () => {
      const safeFile = path.join(testDir, "settings", "claude", "config.json");
      fs.mkdirSync(path.dirname(safeFile), { recursive: true });
      fs.writeFileSync(safeFile, '{"safe": true}');

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const results = validateMultiplePaths([safeFile, "../../../etc/passwd", safeFile], config);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });

    it("should aggregate warnings from multiple files", () => {
      const safeFile1 = path.join(testDir, "settings", "file1.json");
      const safeFile2 = path.join(testDir, "settings", "file2.json");
      const externalLink = path.join(testDir, "settings", "link.json");
      fs.mkdirSync(path.dirname(safeFile1), { recursive: true });
      fs.writeFileSync(safeFile1, "{}");
      fs.writeFileSync(safeFile2, "{}");
      fs.symlinkSync("/etc/hosts", externalLink);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const results = validateMultiplePaths([safeFile1, safeFile2, externalLink], config);

      const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
      expect(totalWarnings).toBeGreaterThan(0);

      fs.unlinkSync(externalLink);
    });
  });

  describe("validateDirectory - recursive security scanning", () => {
    it("should scan entire directory for security issues", () => {
      const settingsDir = path.join(testDir, "settings", "claude");
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(path.join(settingsDir, "config.json"), '{"test": true}');
      fs.writeFileSync(path.join(settingsDir, "rules.json"), '{"rule": "value"}');

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory(settingsDir, config);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should detect external symlinks in nested directories", () => {
      const settingsDir = path.join(testDir, "settings", "claude");
      const nestedDir = path.join(settingsDir, "nested");
      fs.mkdirSync(nestedDir, { recursive: true });

      const externalLink = path.join(nestedDir, "external.json");
      fs.symlinkSync("/etc/passwd", externalLink);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory(settingsDir, config);

      expect(result.isValid).toBe(true); // Warning mode
      expect(result.warnings.length).toBeGreaterThan(0);

      fs.unlinkSync(externalLink);
    });

    it("should fail on directory traversal in directory path", () => {
      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory("../../../etc", config);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Path traversal");
    });

    it("should handle empty directories", () => {
      const emptyDir = path.join(testDir, "empty");
      fs.mkdirSync(emptyDir);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory(emptyDir, config);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should scan large directory structures efficiently", () => {
      const settingsDir = path.join(testDir, "settings", "claude");
      fs.mkdirSync(settingsDir, { recursive: true });

      // Create 100 files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(settingsDir, `file${i}.json`), `{"index": ${i}}`);
      }

      const startTime = Date.now();
      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory(settingsDir, config);
      const duration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe("security edge cases and attack vectors", () => {
    it("should prevent access to sensitive system files", () => {
      const sensitivePaths = ["/etc/passwd", "/etc/shadow", "~/.ssh/id_rsa", "~/.aws/credentials"];

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const results = sensitivePaths.map((path) => validateFilePath(path, config));

      expect(results.every((r) => !r.isValid)).toBe(true);
    });

    it("should handle unicode escape sequences in paths", () => {
      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath("settings/claude/​../../etc/passwd", config);

      expect(result.isValid).toBe(false);
    });

    it("should prevent symlink-based directory traversal", () => {
      const safeDir = path.join(testDir, "safe");
      const escapeDir = path.join(testDir, "escape");
      fs.mkdirSync(safeDir);
      fs.mkdirSync(escapeDir);

      const symlinkPath = path.join(safeDir, "escape-link");
      fs.symlinkSync(escapeDir, symlinkPath);

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateDirectory(safeDir, config);

      expect(result.isValid).toBe(true);
      expect(result.validationContext.hasSymbolicLinks).toBe(true);

      fs.unlinkSync(symlinkPath);
    });

    it("should handle race condition attempts", () => {
      const testFile = path.join(testDir, "test.json");
      fs.writeFileSync(testFile, '{"test": "data"}');

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath(testFile, config);

      expect(result.isValid).toBe(true);

      // Simulate file being replaced after validation
      fs.unlinkSync(testFile);
      fs.writeFileSync(testFile, '{"modified": "content"}');

      // Second validation should still work
      const result2 = validateFilePath(testFile, config);
      expect(result2.isValid).toBe(true);
    });
  });

  describe("configuration variations", () => {
    it("should respect failOnExternalSymlinks setting", () => {
      const externalLink = path.join(testDir, "link.json");
      fs.symlinkSync("/etc/hosts", externalLink);

      const lenientConfig: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const strictConfig: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: true,
      };

      const lenientResult = validateFilePath(externalLink, lenientConfig);
      const strictResult = validateFilePath(externalLink, strictConfig);

      expect(lenientResult.isValid).toBe(true);
      expect(lenientResult.warnings.length).toBeGreaterThan(0);

      expect(strictResult.isValid).toBe(false);
      expect(strictResult.error).toContain("External symbolic link");

      fs.unlinkSync(externalLink);
    });

    it("should respect projectRoot boundary", () => {
      const fileInProject = path.join(testDir, "file.json");
      const fileOutsideProject = "/tmp/file.json";

      fs.writeFileSync(fileInProject, "{}");
      fs.writeFileSync(fileOutsideProject, "{}");

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };

      const inProjectResult = validateFilePath(fileInProject, config);
      const outOfProjectResult = validateFilePath(fileOutsideProject, config);

      expect(inProjectResult.isValid).toBe(true);
      expect(outOfProjectResult.isValid).toBe(false);

      fs.unlinkSync(fileInProject);
      fs.unlinkSync(fileOutsideProject);
    });
  });

  describe("error handling and robustness", () => {
    it("should handle non-existent files gracefully", () => {
      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath("/non/existent/file.json", config);

      // Should not throw, should return some result
      expect(result).toBeDefined();
    });

    it("should handle permission errors gracefully", () => {
      const restrictedFile = path.join(testDir, "restricted.json");
      fs.writeFileSync(restrictedFile, "{}");

      try {
        fs.chmodSync(restrictedFile, 0o000);

        const config: SecurityValidationConfig = {
          projectRoot: testDir,
          allowSymbolicLinks: true,
          failOnExternalSymlinks: false,
        };
        const result = validateFilePath(restrictedFile, config);

        expect(result).toBeDefined();
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(restrictedFile, 0o644);
          fs.unlinkSync(restrictedFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should provide detailed validation context", () => {
      const testFile = path.join(testDir, "test.json");
      fs.writeFileSync(testFile, "{}");

      const config: SecurityValidationConfig = {
        projectRoot: testDir,
        allowSymbolicLinks: true,
        failOnExternalSymlinks: false,
      };
      const result = validateFilePath(testFile, config);

      expect(result.validationContext).toBeDefined();
      expect(result.validationContext.originalPath).toBe(testFile);
      expect(result.validationContext.resolvedPath).toContain(testFile);
      expect(result.validationContext.validatedAt).toBeDefined();
      expect(typeof result.validationContext.validatedAt).toBe("string");
    });
  });
});
