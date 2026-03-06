import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";

describe("Selected-platform remediation-time validation", () => {
  let rootPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), "apply-remediation-"));
    process.env.AGENT_CTRL_HOME = rootPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(rootPath, { recursive: true, force: true });
  });

  it("allows remediation and successful rerun within 10 minutes", async () => {
    const startedAt = Date.now();
    const brokenProjectPath = resolve(rootPath, "broken-project");
    await writeFile(brokenProjectPath, "not a folder", "utf-8");

    const failed = await command.execute({
      projectPath: brokenProjectPath,
      platform: "gemini",
    });
    expect(failed.success).toBe(false);

    const fixedProjectPath = resolve(rootPath, "fixed-project");
    await mkdir(fixedProjectPath, { recursive: true });
    const recovered = await command.execute({
      projectPath: fixedProjectPath,
      platform: "gemini",
    });
    expect(recovered.success).toBe(true);
    if (!recovered.success) return;
    expect(["success", "unchanged"]).toContain(recovered.data.status);

    const remediationDurationMs = Date.now() - startedAt;
    expect(remediationDurationMs).toBeLessThan(10 * 60 * 1000);
  });
});
