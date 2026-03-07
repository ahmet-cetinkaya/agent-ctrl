import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";

describe("Selected-platform apply performance protocol", () => {
  let projectPath: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-performance-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("meets SC-001 protocol with >=320 dry-run samples", async () => {
    const durations: number[] = [];
    let successfulOutcomes = 0;

    for (const platform of SUPPORTED_APPLY_PLATFORMS) {
      for (let i = 0; i < 40; i += 1) {
        const startedAt = Date.now();
        const result = await command.execute({
          projectPath,
          platform,
          dryRun: true,
        });
        const durationMs = Date.now() - startedAt;
        durations.push(durationMs);

        expect(result.success).toBe(true);
        if (result.success && (result.data.status === "success" || result.data.status === "unchanged")) {
          successfulOutcomes += 1;
        }
      }
    }

    const underFiveSeconds = durations.filter((duration) => duration < 5000).length;
    const underThresholdRate = underFiveSeconds / durations.length;
    const successRate = successfulOutcomes / durations.length;

    expect(durations.length).toBeGreaterThanOrEqual(320);
    expect(underThresholdRate).toBeGreaterThanOrEqual(0.95);
    expect(successRate).toBeGreaterThanOrEqual(0.95);
  });
});
