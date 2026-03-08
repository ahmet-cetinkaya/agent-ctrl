import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";
import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";

describe("Selected-platform apply integration flow", () => {
  let projectPath: string;
  let claudeHomePath: string;
  let command: ApplyCommand;
  let registry: PlatformAdapterRegistry;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "apply-flow-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "apply-flow-claude-home-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    command = new ApplyCommand();
    registry = new PlatformAdapterRegistry();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(projectPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("applies only the selected platform", async () => {
    const result = await command.execute({
      projectPath,
      platform: "opencode",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.platform).toBe("opencode");

    for (const platform of SUPPORTED_APPLY_PLATFORMS) {
      const adapter = registry.resolve(platform);
      const target = await adapter.resolveTarget(projectPath);
      const exists = await access(target.configPath)
        .then(() => true)
        .catch(() => false);

      if (platform === "opencode") {
        expect(exists).toBe(true);
      } else {
        expect(exists).toBe(false);
      }
    }
  });
});
