import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { discoverPlatformSettings } from "@/config/scanner.js";

describe("discoverPlatformSettings", () => {
  const testDir = "/tmp/test-scanner-unit";
  const settingsDir = path.join(testDir, "settings");

  beforeEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("no settings directory", () => {
    it("should return empty result when settings/ is absent", async () => {
      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toHaveLength(0);
      expect(result.hasSettingsDirectory).toBe(false);
      expect(result.validationErrors).toHaveLength(0);
    });
  });

  describe("valid platform directories", () => {
    it("should discover a single platform directory", async () => {
      const claudeDir = path.join(settingsDir, "claude");
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "config.json"), "{}");

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toEqual(["claude"]);
      expect(result.hasSettingsDirectory).toBe(true);
      expect(result.settingsDirectories.claude.fileCount).toBe(1);
    });

    it("should discover multiple platform directories", async () => {
      fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
      fs.mkdirSync(path.join(settingsDir, "gemini"), { recursive: true });
      fs.writeFileSync(path.join(settingsDir, "claude", "a.txt"), "a");
      fs.writeFileSync(path.join(settingsDir, "gemini", "b.txt"), "b");

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toContain("claude");
      expect(result.platforms).toContain("gemini");
      expect(result.platforms).toHaveLength(2);
    });

    it("should count files recursively in nested directories", async () => {
      const claudeDir = path.join(settingsDir, "claude");
      fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
      fs.writeFileSync(path.join(claudeDir, "config.json"), "{}");
      fs.writeFileSync(path.join(claudeDir, "rules", "r1.md"), "r1");
      fs.writeFileSync(path.join(claudeDir, "rules", "r2.md"), "r2");

      const result = await discoverPlatformSettings(testDir);
      expect(result.settingsDirectories.claude.fileCount).toBe(3);
    });
  });

  describe("invalid platform directories", () => {
    it("should skip invalid platform names and record errors", async () => {
      fs.mkdirSync(path.join(settingsDir, "vscode"), { recursive: true });

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toHaveLength(0);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });

    it("should ignore files in settings/ that are not directories", async () => {
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.writeFileSync(path.join(settingsDir, "README.md"), "readme");

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toHaveLength(0);
    });

    it("should discover valid platforms alongside invalid ones", async () => {
      fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
      fs.mkdirSync(path.join(settingsDir, "invalid"), { recursive: true });

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toEqual(["claude"]);
      expect(result.validationErrors.length).toBeGreaterThan(0);
    });
  });

  describe("empty platform directory", () => {
    it("should discover platform with zero files", async () => {
      fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });

      const result = await discoverPlatformSettings(testDir);
      expect(result.platforms).toEqual(["claude"]);
      expect(result.settingsDirectories.claude.fileCount).toBe(0);
    });
  });
});
