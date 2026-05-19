import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { AntigravityAdapter } from "@/infrastructure/features/antigravity/adapters/AntigravityAdapter";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";
import { WindsurfAdapter } from "@/infrastructure/features/windsurf/adapters/WindsurfAdapter";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";

describe("Adapter target resolution coverage", () => {
  let projectPath: string;
  let userRootPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "adapter-project-"));
    userRootPath = await mkdtemp(join(tmpdir(), "adapter-user-root-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("resolves project and user scope targets for adapters with documented surfaces", async () => {
    const adapters = [
      new OpenCodeAdapter(),
      new ClaudeApplyAdapter(),
      new GeminiAdapter(),
      new QwenAdapter(),
      new KiloAdapter(),
      new AntigravityAdapter(),
      new CodexAdapter(),
      new CursorAdapter(),
      new WindsurfAdapter(),
    ];
    const userScopeUnsupported = new Set<string>();

    for (const adapter of adapters) {
      if (userScopeUnsupported.has(adapter.platformName)) {
        await expect(
          adapter.resolveTarget(projectPath, {
            projectPath,
            targetScope: "user",
            userConfigRootPath: userRootPath,
          })
        ).rejects.toThrow("does not expose a documented file-backed user configuration surface");
      } else {
        const userTarget = await adapter.resolveTarget(projectPath, {
          projectPath,
          targetScope: "user",
          userConfigRootPath: userRootPath,
        });
        expect(userTarget.scope).toBe("user");
        if (adapter.platformName === "claude") {
          expect(userTarget.configPath).toContain(".claude/CLAUDE.md");
        } else {
          expect(userTarget.configPath).toContain(resolve(userRootPath));
        }
      }

      const projectTarget = await adapter.resolveTarget(projectPath, {
        projectPath,
        targetScope: "project",
        userConfigRootPath: userRootPath,
      });
      expect(projectTarget.scope).toBe("project");
      if (adapter.platformName === "claude") {
        expect(projectTarget.configPath).toBe(resolve(projectPath, "CLAUDE.md"));
      } else {
        expect(projectTarget.configPath).toContain(resolve(projectPath));
      }
    }
  });
});
