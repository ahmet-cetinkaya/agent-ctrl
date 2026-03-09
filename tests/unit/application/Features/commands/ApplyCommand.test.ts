import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
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
});
