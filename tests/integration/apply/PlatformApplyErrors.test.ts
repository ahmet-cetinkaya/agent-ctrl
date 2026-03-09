import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";

describe("Selected-platform apply error reporting", () => {
  let rootPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "apply-errors-"));
    process.env.AGENT_CTRL_HOME = rootPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(rootPath, { recursive: true, force: true });
  });

  it("returns actionable user error for unsupported platform", async () => {
    const result = await command.execute({
      projectPath: rootPath,
      platform: "not-a-platform",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(UserError);
      expect(result.error.message).toContain("Supported platforms");
    }
  });

  it("returns actionable system error for invalid target path", async () => {
    const projectAsFile = resolve(rootPath, "project-as-file");
    await writeFile(projectAsFile, "not a directory", "utf-8");

    const result = await command.execute({
      projectPath: projectAsFile,
      platform: "gemini",
      targetScope: "project",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(SystemError);
      expect(result.error.message).toContain("Failed to apply 'gemini' platform configuration");
    }
  });
});
