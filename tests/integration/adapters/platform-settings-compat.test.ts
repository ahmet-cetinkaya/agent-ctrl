import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import { discoverPlatformSettings } from "@/config/scanner.js";

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
    it("should discover no platform-specific settings", async () => {
      const discovered = await discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(0);
      expect(discovered.hasSettingsDirectory).toBe(false);
      expect(Object.keys(discovered.settingsDirectories)).toHaveLength(0);
    });

    it("should not require settings directory for successful discovery", async () => {
      const discovered = await discoverPlatformSettings(testProjectDir);

      expect(discovered.platforms).toHaveLength(0);
      expect(discovered.hasSettingsDirectory).toBe(false);
    });

    it("should handle all platforms without settings directory", async () => {
      const platforms: Array<"claude" | "gemini" | "cursor"> = ["claude", "gemini", "cursor"];

      for (const _platform of platforms) {
        const discovered = await discoverPlatformSettings(testProjectDir);
        expect(discovered.platforms).toHaveLength(0);
        expect(discovered.hasSettingsDirectory).toBe(false);
      }
    });
  });

  describe("performance without settings directory", () => {
    it("should not introduce performance overhead for settings discovery", async () => {
      const startTime = Date.now();
      const discovered = await discoverPlatformSettings(testProjectDir);
      const duration = Date.now() - startTime;

      expect(discovered.platforms).toHaveLength(0);
      expect(duration).toBeLessThan(100);
    });
  });
});
