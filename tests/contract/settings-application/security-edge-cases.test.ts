import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { discoverPlatformSettings } from "@/config/scanner.js";
import { validatePlatformName } from "@/config/validator.js";

describe("Settings Security Edge Cases Contract", () => {
  const testDir = "/tmp/test-security-edge";
  const settingsDir = path.join(testDir, ".agent-ctrl", "settings");

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(settingsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("platform name attack vectors", () => {
    it("should reject path traversal in platform names", () => {
      for (const name of ["../claude", "..", "./claude", "claude/../gemini"]) {
        expect(validatePlatformName(name).isValid).toBe(false);
      }
    });

    it("should reject null-byte and control characters", () => {
      for (const name of ["claude\0", "gemi\nni", "clau\tde"]) {
        expect(validatePlatformName(name).isValid).toBe(false);
      }
    });

    it("should reject absolute path style names", () => {
      expect(validatePlatformName("/etc/passwd").isValid).toBe(false);
    });
  });

  describe("discovery filters malicious directories", () => {
    it("should not discover directories with traversal-like names", async () => {
      fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
      fs.writeFileSync(path.join(settingsDir, "claude", "ok.txt"), "ok");

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toEqual(["claude"]);
    });

    it("should record validation errors for non-platform directories", async () => {
      fs.mkdirSync(path.join(settingsDir, "etc"), { recursive: true });
      fs.mkdirSync(path.join(settingsDir, "system32"), { recursive: true });

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toHaveLength(0);
      expect(result.validationErrors.length).toBeGreaterThanOrEqual(2);
    });

    it("should keep discovery scoped to the settings directory", async () => {
      const outside = path.join(testDir, "outside");
      fs.mkdirSync(outside, { recursive: true });
      fs.writeFileSync(path.join(outside, "secret.txt"), "secret");
      fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toEqual(["claude"]);
      expect(result.settingsDirectories.claude.path).toContain(path.join("settings", "claude"));
      expect(result.settingsDirectories.claude.path).not.toContain("outside");
    });
  });
});
