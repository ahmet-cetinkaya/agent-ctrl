import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";

describe("Platform customization surface contract", () => {
  let projectPath: string;
  let registry: PlatformAdapterRegistry;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "surface-contract-"));
    registry = new PlatformAdapterRegistry();
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("resolves documented customization surfaces for all supported platforms", async () => {
    const expectedTargets: Record<string, { path: string; scope: "project" | "user" }> = {
      antigravity: { path: resolve(homedir(), ".gemini", "GEMINI.md"), scope: "user" },
      claude: { path: resolve(homedir(), ".claude", "CLAUDE.md"), scope: "user" },
      codex: { path: resolve(homedir(), ".codex", "AGENTS.md"), scope: "user" },
      cursor: { path: resolve(homedir(), ".cursor", "AGENTS.md"), scope: "user" },
      forgecode: { path: resolve(homedir(), ".forge", "AGENTS.md"), scope: "user" },
      gemini: { path: resolve(homedir(), ".gemini", "GEMINI.md"), scope: "user" },
      kilo: { path: resolve(homedir(), "AGENTS.md"), scope: "user" },
      opencode: { path: resolve(homedir(), ".config", "opencode", "AGENTS.md"), scope: "user" },
      qwen: { path: resolve(homedir(), ".qwen", "QWEN.md"), scope: "user" },
      windsurf: { path: resolve(homedir(), ".codeium", "windsurf", "global_rules.md"), scope: "user" },
    };

    for (const platform of registry.listSupportedPlatforms()) {
      const adapter = registry.resolve(platform);
      const target = await adapter.resolveTarget(projectPath);
      expect(target.configPath).toBe(expectedTargets[platform].path);
      expect(target.scope).toBe(expectedTargets[platform].scope);
      expect(target.surface.length).toBeGreaterThan(0);
    }
  });
});
