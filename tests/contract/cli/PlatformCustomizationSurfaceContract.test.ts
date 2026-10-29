import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";

// The Pi-family adapters honor their *_CODING_AGENT_DIR env overrides, so a developer
// machine with senpi/omo running would otherwise change the expected paths mid-test.
const AGENT_DIR_ENV_NAMES = ["PI_CODING_AGENT_DIR", "SENPI_CODING_AGENT_DIR", "OMO_CODING_AGENT_DIR"];

describe("Platform customization surface contract", () => {
  let projectPath: string;
  let registry: PlatformAdapterRegistry;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "surface-contract-"));
    registry = new PlatformAdapterRegistry();
    for (const name of AGENT_DIR_ENV_NAMES) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(async () => {
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(projectPath, { recursive: true, force: true });
  });

  it("resolves documented customization surfaces for all supported platforms", async () => {
    const expectedTargets: Record<string, { path: string; scope: "project" | "user" }> = {
      antigravity: { path: resolve(homedir(), ".gemini", "GEMINI.md"), scope: "user" },
      claude: { path: resolve(homedir(), ".claude", "CLAUDE.md"), scope: "user" },
      codex: { path: resolve(homedir(), ".codex", "AGENTS.md"), scope: "user" },
      cursor: { path: resolve(homedir(), ".cursor", "rules"), scope: "user" },
      forgecode: { path: resolve(homedir(), "forge", "AGENTS.md"), scope: "user" },
      gemini: { path: resolve(homedir(), ".gemini", "GEMINI.md"), scope: "user" },
      kilo: { path: resolve(homedir(), ".config", "kilo", "AGENTS.md"), scope: "user" },
      omonative: { path: resolve(homedir(), ".omo", "agent", "AGENTS.md"), scope: "user" },
      opencode: { path: resolve(homedir(), ".config", "opencode", "AGENTS.md"), scope: "user" },
      pi: { path: resolve(homedir(), ".pi", "agent", "AGENTS.md"), scope: "user" },
      qwen: { path: resolve(homedir(), ".qwen", "AGENTS.md"), scope: "user" },
      senpi: { path: resolve(homedir(), ".senpi", "agent", "AGENTS.md"), scope: "user" },
      windsurf: { path: resolve(homedir(), ".codeium", "windsurf", "rules"), scope: "user" },
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
