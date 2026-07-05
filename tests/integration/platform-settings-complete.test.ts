import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("Complete Platform Settings Workflow Integration", () => {
  let projectPath: string;
  let userRootPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "settings-complete-"));
    userRootPath = await mkdtemp(join(tmpdir(), "settings-complete-user-"));
    await writeApplyFixtures(projectPath);
    command = new ApplyCommand();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("applies standard artifacts and platform-specific settings together", async () => {
    await mkdir(join(projectPath, ".agent-ctrl", "settings", "gemini"), { recursive: true });
    await writeFile(join(projectPath, ".agent-ctrl", "settings", "gemini", "custom.md"), "# Custom\n", "utf-8");

    const result = await command.execute({
      projectPath,
      platform: "gemini",
      userConfigRootPath: userRootPath,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("success");
    expect(result.data.settingsDiscovery?.appliedPlatform).toBe("gemini");
    expect(existsSync(join(userRootPath, "custom.md"))).toBe(true);
  });

  it("remains backward compatible for projects without settings/", async () => {
    const result = await command.execute({
      projectPath,
      platform: "gemini",
      userConfigRootPath: userRootPath,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("success");
    expect(result.data.settingsDiscovery?.discoveredPlatforms).toHaveLength(0);
  });

  it("does not copy settings during dry-run", async () => {
    await mkdir(join(projectPath, ".agent-ctrl", "settings", "gemini"), { recursive: true });
    await writeFile(join(projectPath, ".agent-ctrl", "settings", "gemini", "custom.md"), "# Custom\n", "utf-8");

    const result = await command.execute({
      projectPath,
      platform: "gemini",
      dryRun: true,
      userConfigRootPath: userRootPath,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.settingsDiscovery?.appliedPlatform).toBeNull();
    expect(existsSync(join(userRootPath, "custom.md"))).toBe(false);
  });

  it("only applies settings matching the selected platform", async () => {
    await mkdir(join(projectPath, ".agent-ctrl", "settings", "claude"), { recursive: true });
    await mkdir(join(projectPath, ".agent-ctrl", "settings", "gemini"), { recursive: true });
    await writeFile(join(projectPath, ".agent-ctrl", "settings", "claude", "claude.md"), "c", "utf-8");
    await writeFile(join(projectPath, ".agent-ctrl", "settings", "gemini", "gemini.md"), "g", "utf-8");

    const result = await command.execute({
      projectPath,
      platform: "gemini",
      userConfigRootPath: userRootPath,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(existsSync(join(userRootPath, "gemini.md"))).toBe(true);
    expect(existsSync(join(userRootPath, "claude.md"))).toBe(false);
  });
});
