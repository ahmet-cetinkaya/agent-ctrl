import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";

describe("CommandScopePrecedenceResolver", () => {
  let projectPath: string;
  let resolver: CommandScopePrecedenceResolver;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "scope-resolver-"));
    process.env.AGENT_CTRL_HOME = projectPath;
    delete process.env.AGENT_CTRL_APPLY_SCOPE;
    delete process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT;
    delete process.env.AGENT_CTRL_CURSOR_SCOPE;
    delete process.env.AGENT_CTRL_WINDSURF_SCOPE;
    resolver = new CommandScopePrecedenceResolver();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_HOME;
    delete process.env.AGENT_CTRL_APPLY_SCOPE;
    delete process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT;
    delete process.env.AGENT_CTRL_CURSOR_SCOPE;
    delete process.env.AGENT_CTRL_WINDSURF_SCOPE;
    await rm(projectPath, { recursive: true, force: true });
  });

  it("prefers user scope by default", () => {
    const target = resolver.resolve({
      platform: "gemini",
      projectPath,
      projectRelativePath: ".gemini/commands/appy.toml",
      userRelativePath: "gemini/commands/appy.toml",
    });

    expect(target.scope).toBe("user");
    expect(target.configPath).toContain(projectPath);
  });

  it("forces user scope for untrusted codex project", () => {
    process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT = "false";
    const target = resolver.resolve({
      platform: "codex",
      projectPath,
      projectRelativePath: ".codex/skills/appy/SKILL.md",
      userRelativePath: "codex/skills/appy/SKILL.md",
    });

    expect(target.scope).toBe("user");
  });

  it("supports explicit global apply scope override", () => {
    process.env.AGENT_CTRL_APPLY_SCOPE = "user";
    const target = resolver.resolve({
      platform: "cursor",
      projectPath,
      projectRelativePath: ".cursor/rules/appy.mdc",
      userRelativePath: "cursor/rules/appy.mdc",
    });

    expect(target.scope).toBe("user");
  });

  it("supports explicit project scope selection", () => {
    const target = resolver.resolve({
      platform: "cursor",
      projectPath,
      projectRelativePath: ".cursor/rules/appy.mdc",
      userRelativePath: "cursor/rules/appy.mdc",
      preferredScope: "project",
    });

    expect(target.scope).toBe("project");
    expect(target.configPath).toContain(".cursor/rules/appy.mdc");
  });

  describe("Environment Variable Parsing", () => {
    it("handles case-insensitive 'false' value for codex trusted project", () => {
      // Test that only "false" (case-insensitive) results in user scope
      const falseValues = ["false", "FALSE", "False", "fAlSe"];

      for (const value of falseValues) {
        process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT = value;
        const target = resolver.resolve({
          platform: "codex",
          projectPath,
          projectRelativePath: ".codex/skills/appy/SKILL.md",
          userRelativePath: "codex/skills/appy/SKILL.md",
        });

        expect(target.scope).toBe("user");
      }
    });

    it("defaults to user scope when codex trusted project env var is not set", () => {
      delete process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT;

      const target = resolver.resolve({
        platform: "codex",
        projectPath,
        projectRelativePath: ".codex/skills/appy/SKILL.md",
        userRelativePath: "codex/skills/appy/SKILL.md",
      });

      // Default behavior is to use user scope
      expect(target.scope).toBe("user");
    });

    it("handles case variations for global apply scope", () => {
      // Test that case variations are handled correctly
      process.env.AGENT_CTRL_APPLY_SCOPE = "USER";
      const target1 = resolver.resolve({
        platform: "cursor",
        projectPath,
        projectRelativePath: ".cursor/rules/appy.mdc",
        userRelativePath: "cursor/rules/appy.mdc",
      });

      expect(target1.scope).toBe("user");
    });
  });
});
