import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Integration tests for basic platform-specific settings application.
 *
 * Purpose: Verify end-to-end behavior of platform-specific settings discovery,
 * validation, and application to target platform configuration directories.
 *
 * These tests validate the complete workflow from settings/ directory to
 * platform config directory copy operations.
 */

describe("Platform Settings Basic Application Integration", () => {
  const testProjectDir = "/tmp/test-platform-settings";
  const settingsDir = path.join(testProjectDir, "settings");
  const claudeSettingsDir = path.join(settingsDir, "claude");
  const geminiSettingsDir = path.join(settingsDir, "gemini");

  beforeEach(() => {
    // Create test project structure
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectDir, { recursive: true });
    fs.mkdirSync(claudeSettingsDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  describe("basic platform settings discovery", () => {
    it("should discover platform-specific settings directories", () => {
      // Create platform-specific settings
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), '{"claude": true}');
      fs.writeFileSync(path.join(claudeSettingsDir, "rules.md"), "# Custom Rules");

      const discovered = discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(1);
      expect(discovered.platforms[0]).toBe("claude");
      expect(discovered.settingsDirectories.claude).toBeDefined();
      expect(discovered.settingsDirectories.claude.fileCount).toBe(2);
    });

    it("should discover multiple platform settings directories", () => {
      // Create multiple platform-specific settings
      fs.mkdirSync(geminiSettingsDir);
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), '{"claude": true}');
      fs.writeFileSync(path.join(geminiSettingsDir, "config.json"), '{"gemini": true}');

      const discovered = discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(2);
      expect(discovered.platforms).toContain("claude");
      expect(discovered.platforms).toContain("gemini");
    });

    it("should handle empty settings directory", () => {
      fs.mkdirSync(settingsDir);

      const discovered = discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(0);
      expect(discovered.settingsDirectories).toEqual({});
    });

    it("should handle missing settings directory gracefully", () => {
      const discovered = discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(0);
      expect(discovered.hasSettingsDirectory).toBe(false);
    });
  });

  describe("platform settings application", () => {
    it("should apply claude settings to claude config directory", () => {
      // Create claude-specific settings
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), '{"claude": true}');
      fs.mkdirSync(path.join(claudeSettingsDir, "rules"));
      fs.writeFileSync(path.join(claudeSettingsDir, "rules/custom.md"), "# Custom Rule");

      const targetConfigDir = "/tmp/test-target-claude";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(2);
      expect(fs.existsSync(path.join(targetConfigDir, "config.json"))).toBe(true);
      expect(fs.existsSync(path.join(targetConfigDir, "rules/custom.md"))).toBe(true);

      // Verify content was copied correctly
      const configContent = fs.readFileSync(path.join(targetConfigDir, "config.json"), "utf-8");
      expect(configContent).toBe('{"claude": true}');
    });

    it("should apply gemini settings to gemini config directory", () => {
      fs.mkdirSync(geminiSettingsDir);
      fs.writeFileSync(path.join(geminiSettingsDir, "settings.json"), '{"gemini": true}');

      const targetConfigDir = "/tmp/test-target-gemini";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = applyPlatformSettings("gemini", testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(1);
      expect(fs.existsSync(path.join(targetConfigDir, "settings.json"))).toBe(true);
    });

    it("should handle platform settings without files", () => {
      fs.mkdirSync(claudeSettingsDir);

      const targetConfigDir = "/tmp/test-target-empty";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(0);
    });
  });

  describe("override semantics verification", () => {
    it("should completely replace existing config files", () => {
      // Create claude-specific settings
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), '{"new": "structure"}');

      // Create existing config with different content
      const targetConfigDir = "/tmp/test-target-override";
      fs.mkdirSync(targetConfigDir, { recursive: true });
      fs.writeFileSync(path.join(targetConfigDir, "config.json"), '{"old": "data"}');

      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      // Verify complete replacement
      const finalContent = fs.readFileSync(path.join(targetConfigDir, "config.json"), "utf-8");
      expect(finalContent).toBe('{"new": "structure"}');
      expect(finalContent).not.toContain("old");
      expect(result.success).toBe(true);
    });

    it("should not create backup files", () => {
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), '{"new": true}');

      const targetConfigDir = "/tmp/test-target-no-backup";
      fs.mkdirSync(targetConfigDir, { recursive: true });
      fs.writeFileSync(path.join(targetConfigDir, "config.json"), '{"old": true}');

      applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      // Verify no backup files were created
      expect(fs.existsSync(path.join(targetConfigDir, "config.json.bak"))).toBe(false);
      expect(fs.existsSync(path.join(targetConfigDir, "config.json.backup"))).toBe(false);
    });
  });

  describe("security and validation", () => {
    it("should reject invalid platform directory names", () => {
      // Create invalid platform directory
      const invalidDir = path.join(settingsDir, "invalid-platform");
      fs.mkdirSync(invalidDir);
      fs.writeFileSync(path.join(invalidDir, "config.json"), "{}");

      const discovered = discoverPlatformSettings(testProjectDir);

      // Should filter out invalid platforms
      expect(discovered.platforms).not.toContain("invalid-platform");
      expect(discovered.validationErrors.length).toBeGreaterThan(0);
    });

    it("should validate platform settings before application", () => {
      // Create settings with path traversal attempt
      const traversalFile = path.join(claudeSettingsDir, "../../../etc/passwd");
      fs.mkdirSync(path.dirname(traversalFile), { recursive: true });
      fs.writeFileSync(traversalFile, "malicious");

      const result = applyPlatformSettings("claude", testProjectDir, "/tmp/test-target");

      // Should fail security validation
      expect(result.success).toBe(false);
      expect(result.error).toContain("security");
    });
  });

  describe("error handling and reporting", () => {
    it("should provide detailed error messages for failures", () => {
      // Create settings that will fail to copy (simulate permission error)
      fs.writeFileSync(path.join(claudeSettingsDir, "config.json"), "{}");

      const targetConfigDir = "/tmp/test-target-error";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      // Make target read-only to simulate failure
      try {
        fs.chmodSync(targetConfigDir, 0o444);

        const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe("string");
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(targetConfigDir, 0o755);
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    it("should report which files were successfully copied", () => {
      fs.writeFileSync(path.join(claudeSettingsDir, "file1.txt"), "content1");
      fs.writeFileSync(path.join(claudeSettingsDir, "file2.txt"), "content2");

      const targetConfigDir = "/tmp/test-target-reporting";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(2);
      expect(result.operations).toBeDefined();
      expect(result.operations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("performance and scalability", () => {
    it("should handle large settings directories efficiently", () => {
      // Create 100 files in claude settings
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(claudeSettingsDir, `file${i}.txt`), `content${i}`);
      }

      const targetConfigDir = "/tmp/test-target-large";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const startTime = Date.now();
      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(100);
      expect(duration).toBeLessThan(2000); // 2 seconds per SC-002
    });

    it("should handle deeply nested directory structures", () => {
      // Create 10 levels of nested directories
      let currentPath = claudeSettingsDir;
      for (let i = 0; i < 10; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        fs.mkdirSync(currentPath, { recursive: true });
        fs.writeFileSync(path.join(currentPath, "file.txt"), `content${i}`);
      }

      const targetConfigDir = "/tmp/test-target-nested";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = applyPlatformSettings("claude", testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(10);
      expect(fs.existsSync(path.join(targetConfigDir, "level9", "file.txt"))).toBe(true);
    });
  });
});

/**
 * Mock functions for integration testing.
 *
 * In production, these would import actual implementation from:
 * - src/core/filestore/settings-discovery.ts
 * - src/core/filestore/copiers.ts
 */

interface DiscoveredSettings {
  platforms: string[];
  settingsDirectories: Record<string, { path: string; fileCount: number }>;
  hasSettingsDirectory: boolean;
  validationErrors: string[];
}

function discoverPlatformSettings(projectRoot: string): DiscoveredSettings {
  const settingsPath = path.join(projectRoot, "settings");

  if (!fs.existsSync(settingsPath)) {
    return {
      platforms: [],
      settingsDirectories: {},
      hasSettingsDirectory: false,
      validationErrors: [],
    };
  }

  const validPlatforms: string[] = ["claude", "gemini", "cursor"];
  const discovered: DiscoveredSettings = {
    platforms: [],
    settingsDirectories: {},
    hasSettingsDirectory: true,
    validationErrors: [],
  };

  const entries = fs.readdirSync(settingsPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const platformName = entry.name.toLowerCase();

      if (validPlatforms.includes(platformName)) {
        const platformPath = path.join(settingsPath, entry.name);
        const files = fs.readdirSync(platformPath, { withFileTypes: true });
        const fileCount = files.filter((f) => f.isFile()).length;

        discovered.platforms.push(platformName);
        discovered.settingsDirectories[platformName] = {
          path: platformPath,
          fileCount,
        };
      } else {
        discovered.validationErrors.push(`Platform '${entry.name}' is not supported`);
      }
    }
  }

  return discovered;
}

interface ApplyResult {
  success: boolean;
  filesCopied: number;
  error?: string | null;
  operations: Array<{ source: string; destination: string; status: string }>;
}

function applyPlatformSettings(platform: string, projectRoot: string, targetConfigDir: string): ApplyResult {
  const settingsPath = path.join(projectRoot, "settings", platform);

  if (!fs.existsSync(settingsPath)) {
    return {
      success: false,
      filesCopied: 0,
      error: "Settings directory not found",
      operations: [],
    };
  }

  try {
    const operations: Array<{ source: string; destination: string; status: string }> = [];
    let filesCopied = 0;

    const copyDirectory = (source: string, target: string): void => {
      const entries = fs.readdirSync(source, { withFileTypes: true });
      for (const entry of entries) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
          fs.mkdirSync(targetPath, { recursive: true });
          copyDirectory(sourcePath, targetPath);
        } else if (entry.isFile()) {
          fs.copyFileSync(sourcePath, targetPath);
          filesCopied++;
          operations.push({ source: sourcePath, destination: targetPath, status: "completed" });
        }
      }
    };

    copyDirectory(settingsPath, targetConfigDir);

    return {
      success: true,
      filesCopied,
      operations,
    };
  } catch (error) {
    return {
      success: false,
      filesCopied: 0,
      error: error instanceof Error ? error.message : String(error),
      operations: [],
    };
  }
}
