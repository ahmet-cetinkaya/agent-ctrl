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

    it("ignores invalid environment variable values and uses default", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "invalid";
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        defaultScope: "project",
      });

      expect(target.scope).toBe("project");
    });

    it("handles empty environment variable string", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "";
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        defaultScope: "user",
      });

      expect(target.scope).toBe("user");
    });

    it("prefers explicit scope over environment variable", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "user";
      const target = resolver.resolve({
        platform: "cursor",
        projectConfigPath: resolve(projectPath, ".cursor"),
        preferredScope: "project",
      });

      expect(target.scope).toBe("project");
    });

    it("handles PROJECT from environment variable", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "PROJECT";
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        defaultScope: "user",
      });

      expect(target.scope).toBe("project");
    });
  });

  describe("Surface Detection", () => {
    it("returns correct surface for opencode platform", () => {
      const target = resolver.resolve({
        platform: "opencode",
        projectConfigPath: resolve(projectPath, "AGENTS.md"),
        userConfigPath: resolve(projectPath, ".config", "opencode", "AGENTS.md"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("agents-md-commands-skills-agents-mcp");
    });

    it("returns correct surface for claude platform", () => {
      const target = resolver.resolve({
        platform: "claude",
        projectConfigPath: resolve(projectPath, "CLAUDE.md"),
        userConfigPath: resolve(projectPath, ".claude", "CLAUDE.md"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("memory-skills-agents-mcp");
    });

    it("returns correct surface for gemini platform", () => {
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("gemini-md-commands-settings");
    });

    it("returns correct surface for qwen platform", () => {
      const target = resolver.resolve({
        platform: "qwen",
        projectConfigPath: resolve(projectPath, "QWEN.md"),
        userConfigPath: resolve(projectPath, ".qwen", "QWEN.md"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("qwen-md-commands-skills-settings");
    });

    it("returns correct surface for kilo platform", () => {
      const target = resolver.resolve({
        platform: "kilo",
        projectConfigPath: resolve(projectPath, ".kilocore"),
        userConfigPath: resolve(projectPath, ".kilocode-global"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("rules-workflows-skills-agents-mcp");
    });

    it("returns correct surface for antigravity platform", () => {
      const target = resolver.resolve({
        platform: "antigravity",
        projectConfigPath: resolve(projectPath, ".antigravity"),
        userConfigPath: resolve(projectPath, ".antigravity-global"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("rules-workflows-skills-mcp");
    });

    it("returns correct surface for codex platform", () => {
      const target = resolver.resolve({
        platform: "codex",
        projectConfigPath: resolve(projectPath, "AGENTS.md"),
        userConfigPath: resolve(projectPath, ".codex", "AGENTS.md"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("agents-md-skills-config-toml");
    });

    it("returns correct surface for cursor platform", () => {
      const target = resolver.resolve({
        platform: "cursor",
        projectConfigPath: resolve(projectPath, ".cursor"),
        preferredScope: "project",
      });

      expect(target.surface).toBe("rules-skills-commands-agents-mcp");
    });

    it("returns correct surface for windsurf platform", () => {
      const target = resolver.resolve({
        platform: "windsurf",
        projectConfigPath: resolve(projectPath, ".windsurf"),
        userConfigPath: resolve(projectPath, ".windsurf-global"),
        preferredScope: "user",
      });

      expect(target.surface).toBe("global-rules-workflows-skills-mcp");
    });
  });

  describe("Scope Resolution Priority", () => {
    it("prioritizes preferredScope over environment variable and default", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "user";
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        preferredScope: "project",
        defaultScope: "user",
      });

      expect(target.scope).toBe("project");
    });

    it("prioritizes environment variable over default", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "project";
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        defaultScope: "user",
      });

      expect(target.scope).toBe("project");
    });

    it("uses default when neither preferred nor env var are set", () => {
      const target = resolver.resolve({
        platform: "gemini",
        projectConfigPath: resolve(projectPath, "GEMINI.md"),
        userConfigPath: resolve(projectPath, ".gemini-user", "GEMINI.md"),
        defaultScope: "project",
      });

      expect(target.scope).toBe("project");
    });
  });
});
