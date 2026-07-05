import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("ApplyCommand", () => {
  let projectPath: string;
  let userRootPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-command-"));
    userRootPath = await mkdtemp(join(tmpdir(), "apply-command-user-"));
    await writeApplyFixtures(projectPath);
    command = new ApplyCommand();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("fails for unsupported platform", async () => {
    const result = await command.execute({
      projectPath,
      platform: "unknown",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
      expect(result.error.message).toContain("Supported platforms");
      expect(result.error.message).toContain("opencode");
    }
  });

  it("applies a selected platform successfully", async () => {
    const result = await command.execute({
      projectPath,
      platform: "gemini",
      userConfigRootPath: userRootPath,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.platform).toBe("gemini");
    expect(result.data.status).toBe("success");
    expect(result.data.scope).toBe("user");
    expect(result.data.configPath).toContain("GEMINI.md");
  });

  it("returns unchanged on deterministic rerun", async () => {
    const first = await command.execute({
      projectPath,
      platform: "cursor",
    });
    expect(first.success).toBe(true);

    const second = await command.execute({
      projectPath,
      platform: "cursor",
    });
    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.data.status).toBe("unchanged");
  });

  it("supports dry-run without writes", async () => {
    const result = await command.execute({
      projectPath,
      platform: "windsurf",
      dryRun: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.warnings).toContain("Dry run mode: no file system changes were written.");
  });

  describe("settings discovery", () => {
    it("reports empty discovery when no settings directory exists", async () => {
      const result = await command.execute({
        projectPath,
        platform: "gemini",
        userConfigRootPath: userRootPath,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.settingsDiscovery).toBeDefined();
      expect(result.data.settingsDiscovery?.discoveredPlatforms).toHaveLength(0);
      expect(result.data.settingsDiscovery?.appliedPlatform).toBeNull();
    });

    it("discovers and applies platform-specific settings", async () => {
      await mkdir(join(projectPath, ".agent-ctrl", "settings", "gemini"), { recursive: true });
      await writeFile(join(projectPath, ".agent-ctrl", "settings", "gemini", "extra.md"), "# Extra\n", "utf-8");

      const result = await command.execute({
        projectPath,
        platform: "gemini",
        userConfigRootPath: userRootPath,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.settingsDiscovery?.discoveredPlatforms).toContain("gemini");
      expect(result.data.settingsDiscovery?.appliedPlatform).toBe("gemini");
      expect(result.data.settingsDiscovery?.filesCopied).toBeGreaterThan(0);
      expect(result.data.warnings.some((w) => w.includes("platform-specific setting"))).toBe(true);
    });

    it("does not apply settings for a platform without a settings directory", async () => {
      await mkdir(join(projectPath, ".agent-ctrl", "settings", "claude"), { recursive: true });
      await writeFile(join(projectPath, ".agent-ctrl", "settings", "claude", "x.md"), "x", "utf-8");

      const result = await command.execute({
        projectPath,
        platform: "gemini",
        userConfigRootPath: userRootPath,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.settingsDiscovery?.discoveredPlatforms).toContain("claude");
      expect(result.data.settingsDiscovery?.appliedPlatform).toBeNull();
    });

    it("surfaces validation errors for invalid platform directories", async () => {
      await mkdir(join(projectPath, ".agent-ctrl", "settings", "vscode"), { recursive: true });
      await writeFile(join(projectPath, ".agent-ctrl", "settings", "vscode", "y.md"), "y", "utf-8");

      const result = await command.execute({
        projectPath,
        platform: "gemini",
        userConfigRootPath: userRootPath,
      });

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data.warnings.some((w) => w.includes("Settings validation"))).toBe(true);
    });

    it("fails the command when platform-specific settings copy fails", async () => {
      const geminiSettingsDir = join(projectPath, ".agent-ctrl", "settings", "gemini");
      await mkdir(geminiSettingsDir, { recursive: true });
      await writeFile(join(geminiSettingsDir, "extra.md"), "# Extra\n", "utf-8");

      // Make the user config root unwritable so the settings copy step fails.
      await chmod(userRootPath, 0o444);
      try {
        const result = await command.execute({
          projectPath,
          platform: "gemini",
          userConfigRootPath: userRootPath,
        });

        expect(result.success).toBe(false);
        if (result.success) return;

        expect(result.error).toBeInstanceOf(SystemError);
        expect(result.error.message).toContain("gemini");
      } finally {
        await chmod(userRootPath, 0o755);
      }
    });

    it("fails the command when a settings directory contains a symlink escaping the project", async () => {
      const geminiSettingsDir = join(projectPath, ".agent-ctrl", "settings", "gemini");
      await mkdir(geminiSettingsDir, { recursive: true });
      const outsideFile = join(tmpdir(), `apply-command-outside-${Date.now()}.txt`);
      await writeFile(outsideFile, "secret", "utf-8");

      try {
        const { symlink } = await import("node:fs/promises");
        await symlink(outsideFile, join(geminiSettingsDir, "escape-link.txt"));

        const result = await command.execute({
          projectPath,
          platform: "gemini",
          userConfigRootPath: userRootPath,
        });

        // A symlink inside settings/gemini that escapes the project root must
        // be rejected by discovery's security check, failing the command
        // rather than silently proceeding without the settings applied.
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error).toBeInstanceOf(SystemError);
        expect(result.error.message).toContain("security");
      } finally {
        await rm(outsideFile, { force: true });
      }
    });
  });
});
