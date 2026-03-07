import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";

describe("Selected-platform apply idempotency", () => {
  let projectPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-idempotency-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("returns unchanged on second run and preserves deterministic content", async () => {
    const first = await command.execute({
      projectPath,
      platform: "qwen",
    });
    expect(first.success).toBe(true);
    if (!first.success) return;

    const firstContent = await readFile(first.data.configPath, "utf-8");

    const second = await command.execute({
      projectPath,
      platform: "qwen",
    });
    expect(second.success).toBe(true);
    if (!second.success) return;

    const secondContent = await readFile(second.data.configPath, "utf-8");
    expect(second.data.status).toBe("unchanged");
    expect(secondContent).toBe(firstContent);
  });
});
