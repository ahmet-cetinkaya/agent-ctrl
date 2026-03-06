import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";

describe("ApplyCommand", () => {
  let projectPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-command-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
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
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.platform).toBe("gemini");
    expect(result.data.status).toBe("success");
    expect(result.data.scope).toBe("project");
    expect(result.data.configPath).toContain(".gemini/commands/appy.toml");
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
