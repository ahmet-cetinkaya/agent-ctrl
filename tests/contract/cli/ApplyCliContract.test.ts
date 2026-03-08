import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApplyCommand } from "@/presentation/cli/features/apply/commands/apply";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";

describe("Apply CLI contract", () => {
  let projectPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-cli-contract-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("documents selected-platform argument contract in help text", () => {
    const cliCommand = createApplyCommand();
    const help = cliCommand.helpInformation();

    expect(help).toContain("opencode");
    expect(help).toContain("claude");
    expect(help).toContain("gemini");
    expect(help).toContain("windsurf");
    expect(help).toContain("--project");
    expect(help).toContain("--path");
  });

  it("maps success and unchanged outcomes to successful execution", async () => {
    const first = await command.execute({
      projectPath,
      platform: "kilo",
    });
    expect(first.success).toBe(true);
    if (!first.success) return;
    expect(first.data.status).toBe("success");

    const second = await command.execute({
      projectPath,
      platform: "kilo",
    });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.status).toBe("unchanged");
  });

  it("returns user error for invalid platform input", async () => {
    const result = await command.execute({
      projectPath,
      platform: "invalid-platform",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
    }
  });

  it("supports project scope execution when explicitly requested", async () => {
    const result = await command.execute({
      projectPath,
      platform: "opencode",
      targetScope: "project",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.scope).toBe("project");
  });
});
