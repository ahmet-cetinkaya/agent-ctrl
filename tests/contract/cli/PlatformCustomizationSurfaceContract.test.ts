import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";

describe("Platform customization surface contract", () => {
  let projectPath: string;
  let registry: PlatformAdapterRegistry;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "surface-contract-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    registry = new PlatformAdapterRegistry();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("resolves documented customization surfaces for all supported platforms", async () => {
    const expectedPathFragments: Record<string, string> = {
      opencode: "opencode/commands/appy.md",
      claude: ".claude/CLAUDE.md",
      gemini: "gemini/commands/appy.toml",
      qwen: "qwen/commands/appy.toml",
      kilo: "kilo/workflows/appy.md",
      antigravity: "antigravity/rules/appy.md",
      codex: "codex/skills/appy/SKILL.md",
      cursor: "cursor/rules/appy.mdc",
      windsurf: "windsurf/rules/appy.md",
    };

    for (const platform of registry.listSupportedPlatforms()) {
      const adapter = registry.resolve(platform);
      const target = await adapter.resolveTarget(projectPath);
      expect(target.configPath).toContain(expectedPathFragments[platform]);
      expect(target.surface.length).toBeGreaterThan(0);
    }
  });
});
