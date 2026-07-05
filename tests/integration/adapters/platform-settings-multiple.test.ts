import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { discoverPlatformSettings } from "@/config/scanner.js";
import { copyMultiplePlatformSettings } from "@/core/filestore/copiers.js";

describe("Multi-Platform Settings Application Integration", () => {
  const testDir = "/tmp/test-multi-platform";
  const settingsDir = path.join(testDir, ".agent-ctrl", "settings");
  const targetRoot = "/tmp/test-multi-target";

  beforeEach(() => {
    for (const dir of [testDir, targetRoot]) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  afterEach(() => {
    for (const dir of [testDir, targetRoot]) {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("should discover and apply settings for multiple platforms", async () => {
    const claudeDir = path.join(settingsDir, "claude");
    const geminiDir = path.join(settingsDir, "gemini");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "config.json"), '{"claude": true}');
    fs.writeFileSync(path.join(geminiDir, "config.json"), '{"gemini": true}');

    const discovered = await discoverPlatformSettings(testDir);
    expect(discovered.platforms).toHaveLength(2);

    const claudeTarget = path.join(targetRoot, "claude");
    const geminiTarget = path.join(targetRoot, "gemini");
    fs.mkdirSync(claudeTarget, { recursive: true });
    fs.mkdirSync(geminiTarget, { recursive: true });

    const results = copyMultiplePlatformSettings([
      { source: discovered.settingsDirectories.claude.path, target: claudeTarget },
      { source: discovered.settingsDirectories.gemini.path, target: geminiTarget },
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
    expect(fs.readFileSync(path.join(claudeTarget, "config.json"), "utf-8")).toBe('{"claude": true}');
    expect(fs.readFileSync(path.join(geminiTarget, "config.json"), "utf-8")).toBe('{"gemini": true}');
  });

  it("should isolate settings between platforms", async () => {
    const claudeDir = path.join(settingsDir, "claude");
    const geminiDir = path.join(settingsDir, "gemini");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "claude-only.txt"), "claude");
    fs.writeFileSync(path.join(geminiDir, "gemini-only.txt"), "gemini");

    const discovered = await discoverPlatformSettings(testDir);
    const claudeTarget = path.join(targetRoot, "claude");
    const geminiTarget = path.join(targetRoot, "gemini");
    fs.mkdirSync(claudeTarget, { recursive: true });
    fs.mkdirSync(geminiTarget, { recursive: true });

    copyMultiplePlatformSettings([
      { source: discovered.settingsDirectories.claude.path, target: claudeTarget },
      { source: discovered.settingsDirectories.gemini.path, target: geminiTarget },
    ]);

    expect(fs.existsSync(path.join(claudeTarget, "claude-only.txt"))).toBe(true);
    expect(fs.existsSync(path.join(claudeTarget, "gemini-only.txt"))).toBe(false);
    expect(fs.existsSync(path.join(geminiTarget, "gemini-only.txt"))).toBe(true);
    expect(fs.existsSync(path.join(geminiTarget, "claude-only.txt"))).toBe(false);
  });

  it("should report per-platform copy results independently", async () => {
    const claudeDir = path.join(settingsDir, "claude");
    const geminiDir = path.join(settingsDir, "gemini");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(geminiDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, "a.txt"), "a");
    fs.writeFileSync(path.join(geminiDir, "b.txt"), "b");
    fs.writeFileSync(path.join(geminiDir, "c.txt"), "c");

    const discovered = await discoverPlatformSettings(testDir);
    const claudeTarget = path.join(targetRoot, "claude");
    const geminiTarget = path.join(targetRoot, "gemini");
    fs.mkdirSync(claudeTarget, { recursive: true });
    fs.mkdirSync(geminiTarget, { recursive: true });

    const results = copyMultiplePlatformSettings([
      { source: discovered.settingsDirectories.claude.path, target: claudeTarget },
      { source: discovered.settingsDirectories.gemini.path, target: geminiTarget },
    ]);

    expect(results[0].filesCopied).toBe(1);
    expect(results[1].filesCopied).toBe(2);
  });
});
