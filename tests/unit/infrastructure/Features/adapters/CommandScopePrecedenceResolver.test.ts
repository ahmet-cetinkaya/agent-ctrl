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

  it("prefers project scope by default", () => {
    const target = resolver.resolve({
      platform: "gemini",
      projectPath,
      projectRelativePath: ".gemini/commands/appy.toml",
      userRelativePath: ".gemini/commands/appy.toml",
    });

    expect(target.scope).toBe("project");
    expect(target.configPath).toContain(projectPath);
  });

  it("forces user scope for untrusted codex project", () => {
    process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT = "false";
    const target = resolver.resolve({
      platform: "codex",
      projectPath,
      projectRelativePath: ".codex/skills/appy/SKILL.md",
      userRelativePath: ".codex/skills/appy/SKILL.md",
    });

    expect(target.scope).toBe("user");
  });

  it("supports explicit global apply scope override", () => {
    process.env.AGENT_CTRL_APPLY_SCOPE = "user";
    const target = resolver.resolve({
      platform: "cursor",
      projectPath,
      projectRelativePath: ".cursor/rules/appy.mdc",
      userRelativePath: ".cursor/rules/appy.mdc",
    });

    expect(target.scope).toBe("user");
  });
});
