import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";

describe("ClaudeApplyAdapter", () => {
  let projectPath: string;
  let claudeHomePath: string;
  let adapter: ClaudeApplyAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "claude-apply-project-"));
    claudeHomePath = await mkdtemp(join(tmpdir(), "claude-apply-home-"));
    process.env.AGENT_CTRL_CLAUDE_HOME = claudeHomePath;
    adapter = new ClaudeApplyAdapter();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    delete process.env.AGENT_CTRL_CONFIG_DIR;
    await rm(projectPath, { recursive: true, force: true });
    await rm(claudeHomePath, { recursive: true, force: true });
  });

  it("applies full Claude integration from local project artifacts", async () => {
    await mkdir(resolve(projectPath, ".agent-ctrl", "rules"), { recursive: true });
    await mkdir(resolve(projectPath, ".agent-ctrl", "skills", "skill-a"), { recursive: true });
    await mkdir(resolve(projectPath, ".agent-ctrl", "agents"), { recursive: true });
    await mkdir(resolve(projectPath, ".agent-ctrl", "commands", "dev"), { recursive: true });
    await mkdir(resolve(projectPath, ".agent-ctrl", "mcps"), { recursive: true });

    await writeFile(resolve(projectPath, ".agent-ctrl", "rules", "rule-a.md"), "# Rule A\n", "utf-8");
    await writeFile(resolve(projectPath, ".agent-ctrl", "skills", "skill-a", "SKILL.md"), "# Skill A\n", "utf-8");
    await writeFile(resolve(projectPath, ".agent-ctrl", "agents", "agent-a.md"), "Agent body\n", "utf-8");
    await writeFile(resolve(projectPath, ".agent-ctrl", "commands", "dev", "run.md"), "# Run\n", "utf-8");
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "mcps", "bright.json"),
      JSON.stringify({
        mcpServers: {
          Bright: {
            command: "npx",
            args: ["bright"],
            env: { TOKEN: "1" },
          },
        },
      }),
      "utf-8"
    );

    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(claudeHomePath, ".claude", "CLAUDE.md"));

    const claudeFile = await readFile(resolve(claudeHomePath, ".claude", "CLAUDE.md"), "utf-8");
    expect(claudeFile).toContain("# Rule A");

    await expect(access(resolve(claudeHomePath, ".claude", "skills", "skill-a", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(claudeHomePath, ".claude", "agents", "agent-a.md"))).resolves.toBeNull();
    await expect(access(resolve(claudeHomePath, ".claude", "commands", "dev", "run.md"))).resolves.toBeNull();

    const mcpConfig = JSON.parse(await readFile(resolve(claudeHomePath, ".claude", "settings.json"), "utf-8"));
    expect(mcpConfig.mcpServers.Bright.command).toBe("npx");
    expect(mcpConfig.mcpServers.Bright.env.TOKEN).toBe("1");
  });

  it("reapplies Claude artifacts without creating internal state files", async () => {
    await mkdir(resolve(projectPath, ".agent-ctrl", "rules"), { recursive: true });
    await writeFile(resolve(projectPath, ".agent-ctrl", "rules", "rule-a.md"), "# Rule A\n", "utf-8");

    const first = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
    });
    expect(first.status).toBe("success");

    const second = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "user",
    });
    expect(second.status).toBe("success");
    await expect(access(resolve(claudeHomePath, ".claude", ".agent-ctrl.json"))).rejects.toBeDefined();
  });

  it("applies Claude integration to project scope when requested", async () => {
    await mkdir(resolve(projectPath, ".agent-ctrl", "rules"), { recursive: true });
    await mkdir(resolve(projectPath, ".agent-ctrl", "commands"), { recursive: true });
    await writeFile(resolve(projectPath, ".agent-ctrl", "rules", "rule-a.md"), "# Rule A\n", "utf-8");
    await writeFile(resolve(projectPath, ".agent-ctrl", "commands", "run.md"), "# Run\n", "utf-8");

    const result = await adapter.applyAppyIntegration({
      projectPath,
      targetScope: "project",
    });

    expect(result.status).toBe("success");
    expect(result.configPath).toBe(resolve(projectPath, ".claude", "CLAUDE.md"));
    await expect(access(resolve(projectPath, ".claude", "commands", "run.md"))).resolves.toBeNull();
  });
});
