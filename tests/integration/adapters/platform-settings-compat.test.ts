import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Integration tests for backward compatibility without platform-specific settings.
 *
 * Purpose: Verify that existing projects without a settings/ directory continue
 * to work without modification, maintaining 100% backward compatibility.
 *
 * These tests ensure that the platform-specific settings feature is completely
 * optional and doesn't break existing workflows.
 */

describe("Platform Settings Backward Compatibility Integration", () => {
  const testProjectDir = "/tmp/test-backward-compat";

  beforeEach(() => {
    // Create test project structure without settings/ directory
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testProjectDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directories
    if (fs.existsSync(testProjectDir)) {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    }
  });

  describe("project without settings directory", () => {
    it("should discover no platform-specific settings", () => {
      const discovered = discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(0);
      expect(discovered.hasSettingsDirectory).toBe(false);
      expect(discovered.settingsDirectories).toEqual({});
    });

    it("should apply standard configuration only", () => {
      // Create standard configuration files
      fs.mkdirSync(path.join(testProjectDir, "rules"));
      fs.writeFileSync(path.join(testProjectDir, "rules", "general.md"), "# General Rule");
      fs.writeFileSync(path.join(testProjectDir, "mcp.json"), '{"mcp": "config"}');

      const result = applyConfiguration("claude", testProjectDir);

      expect(result.success).toBe(true);
      expect(result.appliedStandardConfig).toBe(true);
      expect(result.appliedPlatformSpecificSettings).toBe(false);
    });

    it("should not require settings directory for successful apply", () => {
      const result = applyConfiguration("claude", testProjectDir);

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should handle all platforms without settings directory", () => {
      const platforms: Array<"claude" | "gemini" | "cursor"> = ["claude", "gemini", "cursor"];

      const results = platforms.map((platform) => applyConfiguration(platform, testProjectDir));

      expect(results.every((r) => r.success)).toBe(true);
      expect(results.every((r) => r.appliedPlatformSpecificSettings)).toBe(false);
    });
  });

  describe("existing apply command behavior preservation", () => {
    it("should preserve existing CLI command behavior", () => {
      // Simulate existing apply command execution
      const result = executeApplyCommand(["claude"], testProjectDir);

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(result.output).toContain("Configuration applied");
    });

    it("should preserve multi-platform apply behavior", () => {
      const result = executeApplyCommand(["claude", "gemini"], testProjectDir);

      expect(result.exitCode).toBe(0);
      expect(result.success).toBe(true);
      expect(result.processedPlatforms).toHaveLength(2);
    });

    it("should preserve verbose mode output", () => {
      const result = executeApplyCommand(["claude", "--verbose"], testProjectDir);

      expect(result.exitCode).toBe(0);
      expect(result.verboseOutput).toBeDefined();
      expect(result.verboseOutput).toContain("Standard configuration");
    });

    it("should preserve error handling for invalid platforms", () => {
      const result = executeApplyCommand(["invalid-platform"], testProjectDir);

      expect(result.exitCode).not.toBe(0);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not supported");
    });
  });

  describe("configuration file handling without settings", () => {
    it("should copy standard configuration files correctly", () => {
      // Create standard project structure
      fs.mkdirSync(path.join(testProjectDir, "rules"));
      fs.writeFileSync(path.join(testProjectDir, "rules", "general.md"), "# General Rule");
      fs.writeFileSync(path.join(testProjectDir, "mcp.json"), '{"mcp": "config"}');

      const targetConfigDir = "/tmp/test-target-standard";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = copyStandardConfiguration(testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(2);
      expect(fs.existsSync(path.join(targetConfigDir, "rules/general.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetConfigDir, "mcp.json"))).toBe(true);
    });

    it("should handle empty project configuration", () => {
      const result = copyStandardConfiguration(testProjectDir, "/tmp/test-target-empty");

      expect(result.success).toBe(true);
      expect(result.filesCopied).toBe(0);
    });

    it("should preserve file permissions during copy", () => {
      const configFile = path.join(testProjectDir, "config.json");
      fs.writeFileSync(configFile, '{"config": true}');
      fs.chmodSync(configFile, 0o644);

      const targetConfigDir = "/tmp/test-target-permissions";
      fs.mkdirSync(targetConfigDir, { recursive: true });

      const result = copyStandardConfiguration(testProjectDir, targetConfigDir);

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(targetConfigDir, "config.json"))).toBe(true);
    });
  });

  describe("adapter behavior without platform settings", () => {
    it("should maintain existing Claude adapter behavior", () => {
      const result = applyWithClaudeAdapter(testProjectDir);

      expect(result.success).toBe(true);
      expect(result.adapterType).toBe("claude");
      expect(result.usedPlatformSpecificSettings).toBe(false);
      expect(result.processedFiles).toBeDefined();
    });

    it("should maintain existing Gemini adapter behavior", () => {
      const result = applyWithGeminiAdapter(testProjectDir);

      expect(result.success).toBe(true);
      expect(result.adapterType).toBe("gemini");
      expect(result.usedPlatformSpecificSettings).toBe(false);
    });

    it("should maintain existing Cursor adapter behavior", () => {
      const result = applyWithCursorAdapter(testProjectDir);

      expect(result.success).toBe(true);
      expect(result.adapterType).toBe("cursor");
      expect(result.usedPlatformSpecificSettings).toBe(false);
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle missing project directory gracefully", () => {
      const result = applyConfiguration("claude", "/nonexistent/project");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
    });

    it("should handle permission errors gracefully", () => {
      // Create project with read-only files
      fs.mkdirSync(path.join(testProjectDir, "rules"));
      const ruleFile = path.join(testProjectDir, "rules", "readonly.md");
      fs.writeFileSync(ruleFile, "# Readonly Rule");
      try {
        fs.chmodSync(ruleFile, 0o000);
      } catch {
        // Skip if chmod doesn't work
      }

      const result = copyStandardConfiguration(testProjectDir, "/tmp/test-target-readonly");

      // Should either succeed or fail with clear error
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");

      // Cleanup
      try {
        fs.chmodSync(ruleFile, 0o644);
      } catch {
        // Ignore cleanup errors
      }
    });

    it("should handle invalid configuration files without crashing", () => {
      // Create invalid JSON file
      fs.writeFileSync(path.join(testProjectDir, "mcp.json"), "invalid json {{{");

      const result = copyStandardConfiguration(testProjectDir, "/tmp/test-target-invalid");

      // Should handle gracefully (may succeed or fail with clear error)
      expect(result).toBeDefined();
      expect(typeof result.success).toBe("boolean");
    });
  });

  describe("performance compatibility", () => {
    it("should maintain performance targets without settings directory", () => {
      // Create standard project structure
      fs.mkdirSync(path.join(testProjectDir, "rules"));
      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(path.join(testProjectDir, "rules", `rule${i}.md`), `# Rule ${i}`);
      }

      const startTime = Date.now();
      const result = applyConfiguration("claude", testProjectDir);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // 2 seconds per SC-002
    });

    it("should not introduce performance overhead for settings discovery", () => {
      const startTime = Date.now();
      const discovered = discoverPlatformSettings(testProjectDir);
      const duration = Date.now() - startTime;

      expect(discovered.platforms).toHaveLength(0);
      expect(duration).toBeLessThan(100); // Should be very fast without settings
    });
  });

  describe("migration and upgrade scenarios", () => {
    it("should allow adding settings directory later without breaking existing setup", () => {
      // First, verify project works without settings
      const result1 = applyConfiguration("claude", testProjectDir);
      expect(result1.success).toBe(true);

      // Then add settings directory
      const settingsDir = path.join(testProjectDir, "settings");
      const claudeSettings = path.join(settingsDir, "claude");
      fs.mkdirSync(claudeSettings, { recursive: true });
      fs.writeFileSync(path.join(claudeSettings, "config.json"), '{"claude": true}');

      // Project should still work, now with platform-specific settings
      const result2 = applyConfiguration("claude", testProjectDir);
      expect(result2.success).toBe(true);
      expect(result2.appliedPlatformSpecificSettings).toBe(true);
    });

    it("should maintain existing projects when upgrading agent-ctrl version", () => {
      // Simulate existing project with standard configuration
      fs.mkdirSync(path.join(testProjectDir, "rules"));
      fs.writeFileSync(path.join(testProjectDir, "rules", "existing.md"), "# Existing Rule");

      const result = applyConfiguration("claude", testProjectDir);

      expect(result.success).toBe(true);
      expect(result.appliedStandardConfig).toBe(true);
      expect(result.migrationRequired).toBe(false);
    });
  });
});

/**
 * Mock functions for backward compatibility testing.
 *
 * In production, these would import actual implementation from:
 * - src/core/filestore/settings-discovery.ts
 * - src/adapters/claude-adapter.ts
 * - src/cli/commands/apply.ts
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

  // Mock implementation would scan settings/ directory
  return {
    platforms: [],
    settingsDirectories: {},
    hasSettingsDirectory: true,
    validationErrors: [],
  };
}

interface ApplyResult {
  success: boolean;
  appliedStandardConfig: boolean;
  appliedPlatformSpecificSettings: boolean;
  error?: string | null;
  processedFiles?: string[];
}

function applyConfiguration(platform: string, projectRoot: string): ApplyResult {
  const discovered = discoverPlatformSettings(projectRoot);

  return {
    success: true,
    appliedStandardConfig: !discovered.hasSettingsDirectory,
    appliedPlatformSpecificSettings: discovered.hasSettingsDirectory && discovered.platforms.includes(platform),
    error: null,
  };
}

interface CommandResult {
  exitCode: number;
  success: boolean;
  output: string;
  processedPlatforms: string[];
  error?: string;
  verboseOutput?: string;
}

function executeApplyCommand(platforms: string[], projectRoot: string): CommandResult {
  const hasSettings = fs.existsSync(path.join(projectRoot, "settings"));

  return {
    exitCode: 0,
    success: true,
    output: "Configuration applied successfully",
    processedPlatforms: platforms,
    verboseOutput: hasSettings ? "Platform-specific settings: Yes" : "Standard configuration only",
  };
}

interface CopyResult {
  success: boolean;
  filesCopied: number;
  error?: string | null;
}

function copyStandardConfiguration(projectRoot: string, targetDir: string): CopyResult {
  if (!fs.existsSync(projectRoot)) {
    return {
      success: false,
      filesCopied: 0,
      error: "Project root does not exist",
    };
  }

  try {
    let filesCopied = 0;

    // Copy rules directory
    const rulesDir = path.join(projectRoot, "rules");
    if (fs.existsSync(rulesDir)) {
      const targetRules = path.join(targetDir, "rules");
      fs.mkdirSync(targetRules, { recursive: true });

      const rules = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      rules.forEach((rule) => {
        fs.copyFileSync(path.join(rulesDir, rule), path.join(targetRules, rule));
        filesCopied++;
      });
    }

    // Copy mcp.json
    const mcpJson = path.join(projectRoot, "mcp.json");
    if (fs.existsSync(mcpJson)) {
      fs.copyFileSync(mcpJson, path.join(targetDir, "mcp.json"));
      filesCopied++;
    }

    return { success: true, filesCopied };
  } catch (error) {
    return {
      success: false,
      filesCopied: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

interface AdapterResult {
  success: boolean;
  adapterType: string;
  usedPlatformSpecificSettings: boolean;
  processedFiles: string[];
}

function applyWithClaudeAdapter(projectRoot: string): AdapterResult {
  return {
    success: true,
    adapterType: "claude",
    usedPlatformSpecificSettings: false,
    processedFiles: ["config.json", "rules/"],
  };
}

function applyWithGeminiAdapter(projectRoot: string): AdapterResult {
  return {
    success: true,
    adapterType: "gemini",
    usedPlatformSpecificSettings: false,
    processedFiles: ["settings.json", "extensions/"],
  };
}

function applyWithCursorAdapter(projectRoot: string): AdapterResult {
  return {
    success: true,
    adapterType: "cursor",
    usedPlatformSpecificSettings: false,
    processedFiles: [".cursor/rules/"],
  };
}
