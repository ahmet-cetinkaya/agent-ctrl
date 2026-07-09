import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { discoverPlatformSettings } from "@/config/scanner.js";
import { copyPlatformSettings } from "@/core/filestore/copiers.js";

describe("Partial Platform Settings Integration", () => {
  const testDir = "/tmp/test-partial-platform";
  const settingsDir = path.join(testDir, ".agent-ctrl", "settings");
  const targetRoot = "/tmp/test-partial-target";

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

  it("should only discover platforms that have settings directories", async () => {
    fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
    fs.writeFileSync(path.join(settingsDir, "claude", "config.json"), "{}");

    const discovered = await discoverPlatformSettings(testDir);
    expect(discovered.platforms).toEqual(["claude"]);
    expect(discovered.settingsDirectories.gemini).toBeUndefined();
  });

  it("should skip platforms without settings during apply", async () => {
    fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
    fs.writeFileSync(path.join(settingsDir, "claude", "config.json"), "{}");

    const discovered = await discoverPlatformSettings(testDir);
    const requestedPlatforms = ["claude", "gemini", "cursor"];

    const applied: string[] = [];
    for (const platform of requestedPlatforms) {
      if (!discovered.platforms.includes(platform as any)) continue;
      const target = path.join(targetRoot, platform);
      fs.mkdirSync(target, { recursive: true });
      const result = await copyPlatformSettings(discovered.settingsDirectories[platform as "claude"].path, target);
      if (result.success) applied.push(platform);
    }

    expect(applied).toEqual(["claude"]);
  });

  it("should apply settings only for platforms present in settings/", async () => {
    fs.mkdirSync(path.join(settingsDir, "claude"), { recursive: true });
    fs.mkdirSync(path.join(settingsDir, "codex"), { recursive: true });
    fs.writeFileSync(path.join(settingsDir, "claude", "a.txt"), "a");
    fs.writeFileSync(path.join(settingsDir, "codex", "b.txt"), "b");

    const discovered = await discoverPlatformSettings(testDir);
    expect(discovered.platforms).toContain("claude");
    expect(discovered.platforms).toContain("codex");
    expect(discovered.platforms).not.toContain("gemini");
  });
});
