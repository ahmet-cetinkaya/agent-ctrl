import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";

describe("CommandScopePrecedenceResolver", () => {
  let projectPath: string;
  let resolver: CommandScopePrecedenceResolver;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "scope-resolver-"));
    delete process.env.AGENT_CTRL_APPLY_SCOPE;
    resolver = new CommandScopePrecedenceResolver();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_APPLY_SCOPE;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("prefers user scope by default when a documented user path exists", () => {
    const target = resolver.resolve({
      platform: "gemini",
      projectConfigPath: resolve(projectPath, "GEMINI.md"),
      userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
    });

    expect(target.scope).toBe("user");
    expect(target.configPath).toContain(".gemini-user/GEMINI.md");
  });

  it("falls back to project scope when the platform has no documented user path", () => {
    const target = resolver.resolve({
      platform: "cursor",
      projectConfigPath: resolve(projectPath, ".cursor"),
      defaultScope: "project",
    });

    expect(target.scope).toBe("project");
    expect(target.configPath).toContain(".cursor");
  });

  it("supports explicit user scope when a documented user path exists", () => {
    const target = resolver.resolve({
      platform: "opencode",
      projectConfigPath: resolve(projectPath, "AGENTS.md"),
      userConfigPath: resolve(projectPath, ".config", "opencode", "AGENTS.md"),
      preferredScope: "user",
    });

    expect(target.scope).toBe("user");
    expect(target.configPath).toContain(".config/opencode/AGENTS.md");
  });

  it("supports explicit global apply scope override", () => {
    process.env.AGENT_CTRL_APPLY_SCOPE = "user";
    const target = resolver.resolve({
      platform: "kilo",
      projectConfigPath: resolve(projectPath, ".kilocode"),
      userConfigPath: resolve(projectPath, ".kilocode-global"),
    });

    expect(target.scope).toBe("user");
  });

  it("supports explicit project scope selection", () => {
    const target = resolver.resolve({
      platform: "cursor",
      projectConfigPath: resolve(projectPath, ".cursor"),
      preferredScope: "project",
    });

    expect(target.scope).toBe("project");
    expect(target.configPath).toContain(".cursor");
  });

  describe("Environment Variable Parsing", () => {
    it("handles case variations for global apply scope", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "USER";
      const target1 = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
      });

      expect(target1.scope).toBe("user");
    });

    it("throws when user scope is requested without a documented file-backed user path", () => {
      expect(() =>
        resolver.resolve({
          platform: "cursor",
          projectConfigPath: resolve(projectPath, ".cursor"),
          preferredScope: "user",
        })
      ).toThrow("does not expose a documented file-backed user configuration surface");
    });

    it("uses the provided default scope when no overrides are present", () => {
      const target = resolver.resolve({
        platform: "codex",
        projectConfigPath: resolve(projectPath, "AGENTS.md"),
        userConfigPath: resolve(projectPath, ".codex", "AGENTS.md"),
        defaultScope: "user",
      });

      expect(target.scope).toBe("user");
    });
  });
});
