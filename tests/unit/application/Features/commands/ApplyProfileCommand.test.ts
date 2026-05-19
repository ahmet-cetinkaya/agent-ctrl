import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyProfileCommand } from "@/core/application/features/apply/commands/ApplyProfileCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";

describe("ApplyProfileCommand", () => {
  let projectPath: string;
  let configRoot: string;
  let command: ApplyProfileCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-profile-"));
    configRoot = join(projectPath, ".agent-ctrl");
    command = new ApplyProfileCommand();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function setupProfile(profileName: string, artifacts: { rules?: string[]; skills?: string[] } = {}) {
    const profilesPath = join(configRoot, "profiles", profileName);
    await mkdir(profilesPath, { recursive: true });

    if (artifacts.rules) {
      const rulesPath = join(profilesPath, "rules");
      await mkdir(rulesPath, { recursive: true });
      for (const rule of artifacts.rules) {
        await writeFile(join(rulesPath, rule), `# ${rule}\n`, "utf-8");
      }
    }

    if (artifacts.skills) {
      for (const skill of artifacts.skills) {
        const skillPath = join(profilesPath, "skills", skill);
        await mkdir(skillPath, { recursive: true });
        await writeFile(join(skillPath, "SKILL.md"), `# ${skill}\n`, "utf-8");
      }
    }
  }

  async function setupBaseConfig() {
    await mkdir(join(configRoot, "rules"), { recursive: true });
    await writeFile(join(configRoot, "rules", "base-rule.md"), "# Base Rule\n", "utf-8");
  }

  it("fails when config directory does not exist", async () => {
    const nonExistent = join(tmpdir(), "nonexistent-config");
    const result = await command.execute({
      projectPath: nonExistent,
      profileName: "test",
      platform: "opencode",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
      expect(result.error.message).toContain("No .agent-ctrl directory");
    }
  });

  it("fails when profile does not exist", async () => {
    await setupBaseConfig();

    const result = await command.execute({
      projectPath,
      profileName: "nonexistent",
      platform: "opencode",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ProfileError);
      expect(result.error.message).toContain("nonexistent");
    }
  });

  it("fails for unsupported platform", async () => {
    await setupBaseConfig();
    await setupProfile("test");

    const result = await command.execute({
      projectPath,
      profileName: "test",
      platform: "unknown",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
      expect(result.error.message).toContain("not supported");
    }
  });

  it("applies only profile artifacts", async () => {
    await setupBaseConfig();
    await setupProfile("test", { rules: ["profile-rule.md"] });

    const result = await command.execute({
      projectPath,
      profileName: "test",
      platform: "opencode",
    });

    if (!result.success) {
      throw new Error(`Command failed: ${result.error.message}`);
    }

    expect(result.success).toBe(true);

    expect(result.data.platform).toBe("opencode");
    expect(result.data.status).toBe("success");
    expect(result.data.artifactCounts).toBeDefined();
    expect(result.data.artifactCounts?.rules).toBe(1);
  });

  it("reports empty profile", async () => {
    await setupBaseConfig();
    await setupProfile("empty");

    const result = await command.execute({
      projectPath,
      profileName: "empty",
      platform: "opencode",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.isEmpty).toBe(true);
    expect(result.data.artifactCounts?.rules).toBe(0);
  });

  it("supports dry-run mode", async () => {
    await setupBaseConfig();
    await setupProfile("test", { rules: ["profile-rule.md"] });

    const result = await command.execute({
      projectPath,
      profileName: "test",
      platform: "opencode",
      dryRun: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.warnings).toContain("Dry run mode: no file system changes are written.");
  });
});
