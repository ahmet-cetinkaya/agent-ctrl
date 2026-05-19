import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProfileListCommand } from "@/core/application/features/apply/commands/ProfileListCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";

describe("ProfileListCommand", () => {
  let projectPath: string;
  let command: ProfileListCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "profile-list-"));
    command = new ProfileListCommand();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("fails when .agent-ctrl directory does not exist", async () => {
    const result = await command.execute(projectPath);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
      expect(result.error.message).toContain(".agent-ctrl");
    }
  });

  it("returns empty list when profiles directory does not exist", async () => {
    await mkdir(join(projectPath, ".agent-ctrl"), { recursive: true });

    const result = await command.execute(projectPath);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.profiles).toHaveLength(0);
  });

  it("returns empty list when profiles directory is empty", async () => {
    await mkdir(join(projectPath, ".agent-ctrl", "profiles"), { recursive: true });

    const result = await command.execute(projectPath);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.profiles).toHaveLength(0);
  });

  it("returns sorted list of profile names", async () => {
    await mkdir(join(projectPath, ".agent-ctrl", "profiles", "zebra"), { recursive: true });
    await mkdir(join(projectPath, ".agent-ctrl", "profiles", "alpha"), { recursive: true });
    await mkdir(join(projectPath, ".agent-ctrl", "profiles", "middle"), { recursive: true });

    const result = await command.execute(projectPath);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.profiles).toEqual(["alpha", "middle", "zebra"]);
  });

  it("ignores files in profiles directory", async () => {
    const profilesPath = join(projectPath, ".agent-ctrl", "profiles");
    await mkdir(profilesPath, { recursive: true });
    await mkdir(join(profilesPath, "valid-profile"), { recursive: true });

    const { writeFile } = await import("node:fs/promises");
    await writeFile(join(profilesPath, "not-a-profile.txt"), "content", "utf-8");

    const result = await command.execute(projectPath);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.profiles).toEqual(["valid-profile"]);
  });
});
