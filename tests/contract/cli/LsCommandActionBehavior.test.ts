import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRuleCommand } from "@/presentation/cli/features/rule/commands/rule";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { createAgentCommand } from "@/presentation/cli/features/agent/commands/agent";
import { createCommandCommand } from "@/presentation/cli/features/command/commands/command";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { ListRulesQuery } from "@/core/application/features/rule/queries/ListRulesQuery";
import { ListSkillsQuery } from "@/core/application/features/skill/queries/ListSkillsQuery";
import { ListAgentsQuery } from "@/core/application/features/agent/queries/ListAgentsQuery";
import { ListCommandsQuery } from "@/core/application/features/command/queries/ListCommandsQuery";
import { ListMcpServersQuery } from "@/core/application/features/mcp/queries/ListMcpServersQuery";
import { UserError } from "@/core/domain/shared/errors/UserError";

describe("LS command action behavior", () => {
  let homePath: string;
  let configRootPath: string;
  let originalAgentCtrlHome: string | undefined;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExit: typeof process.exit;
  const logs: string[] = [];
  const errors: string[] = [];

  beforeEach(async () => {
    homePath = await mkdirTempDir("ls-cli-action-");
    configRootPath = resolve(homePath, ".agent-ctrl");

    originalAgentCtrlHome = process.env.AGENT_CTRL_HOME;
    process.env.AGENT_CTRL_HOME = homePath;

    originalLog = console.log;
    originalError = console.error;
    originalExit = process.exit;

    console.log = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    };
    process.exit = ((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    }) as typeof process.exit;
  });

  afterEach(async () => {
    console.log = originalLog;
    console.error = originalError;
    process.exit = originalExit;
    logs.length = 0;
    errors.length = 0;

    if (originalAgentCtrlHome === undefined) {
      delete process.env.AGENT_CTRL_HOME;
    } else {
      process.env.AGENT_CTRL_HOME = originalAgentCtrlHome;
    }

    await rm(homePath, { recursive: true, force: true });
  });

  it("renders non-json outputs for rule/skill/agent/command ls", async () => {
    await mkdir(resolve(configRootPath, "rules"), { recursive: true });
    await writeFile(resolve(configRootPath, "rules", "my-rule.md"), "# Rule");
    await writeFile(resolve(configRootPath, "rules", "invalid.txt"), "x");

    await mkdir(resolve(configRootPath, "skills", "my-skill"), { recursive: true });
    await writeFile(resolve(configRootPath, "skills", "my-skill", "SKILL.md"), "# Skill");
    await mkdir(resolve(configRootPath, "skills", "missing-skill"), { recursive: true });

    await mkdir(resolve(configRootPath, "agents"), { recursive: true });
    await writeFile(resolve(configRootPath, "agents", "my-agent.md"), "# Agent");
    await writeFile(resolve(configRootPath, "agents", "invalid.txt"), "x");

    await mkdir(resolve(configRootPath, "commands"), { recursive: true });
    await writeFile(resolve(configRootPath, "commands", "explain.md"), "# Explain");
    await writeFile(resolve(configRootPath, "commands", "invalid.txt"), "x");

    await createRuleCommand().parseAsync(["node", "test", "ls"]);
    await createSkillCommand().parseAsync(["node", "test", "ls"]);
    await createAgentCommand().parseAsync(["node", "test", "ls"]);
    await createCommandCommand().parseAsync(["node", "test", "ls"]);

    expect(logs.some((line) => line.includes("Rules (1):"))).toBe(true);
    expect(logs.some((line) => line.includes("  my-rule"))).toBe(true);
    expect(logs.some((line) => line.includes("Skills (1):"))).toBe(true);
    expect(logs.some((line) => line.includes("  my-skill"))).toBe(true);
    expect(logs.some((line) => line.includes("Agents (1):"))).toBe(true);
    expect(logs.some((line) => line.includes("  my-agent"))).toBe(true);
    expect(logs.some((line) => line.includes("Commands (1):"))).toBe(true);
    expect(logs.some((line) => line.includes("  explain"))).toBe(true);
    expect(logs.some((line) => line.includes("Warnings:"))).toBe(true);
  });

  it("renders json outputs for all ls commands", async () => {
    await mkdir(resolve(configRootPath, "rules"), { recursive: true });
    await writeFile(resolve(configRootPath, "rules", "my-rule.md"), "# Rule");

    await mkdir(resolve(configRootPath, "skills", "my-skill"), { recursive: true });
    await writeFile(resolve(configRootPath, "skills", "my-skill", "SKILL.md"), "# Skill");

    await mkdir(resolve(configRootPath, "agents"), { recursive: true });
    await writeFile(resolve(configRootPath, "agents", "my-agent.md"), "# Agent");

    await mkdir(resolve(configRootPath, "commands"), { recursive: true });
    await writeFile(resolve(configRootPath, "commands", "explain.md"), "# Explain");

    const mcpDir = resolve(configRootPath, "mcps");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      resolve(mcpDir, "servers.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: {
              command: "node",
              args: ["server.js"],
            },
          },
        },
        null,
        2
      )
    );

    await createRuleCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createSkillCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createAgentCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createCommandCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createMcpCommand().parseAsync(["node", "test", "ls", "--json"]);

    expect(logs.some((line) => line.includes("\"artifacts\""))).toBe(true);
    expect(logs.some((line) => line.includes("\"servers\""))).toBe(true);
    expect(logs.some((line) => line.includes("\"configRoot\""))).toBe(true);
  });

  it("handles empty non-json outputs for rule/skill/agent/command ls", async () => {
    await mkdir(resolve(configRootPath, "rules"), { recursive: true });
    await mkdir(resolve(configRootPath, "skills"), { recursive: true });
    await mkdir(resolve(configRootPath, "agents"), { recursive: true });
    await mkdir(resolve(configRootPath, "commands"), { recursive: true });

    await createRuleCommand().parseAsync(["node", "test", "ls"]);
    await createSkillCommand().parseAsync(["node", "test", "ls"]);
    await createAgentCommand().parseAsync(["node", "test", "ls"]);
    await createCommandCommand().parseAsync(["node", "test", "ls"]);

    expect(logs.some((line) => line.includes("No rules found"))).toBe(true);
    expect(logs.some((line) => line.includes("No skills found"))).toBe(true);
    expect(logs.some((line) => line.includes("No agents found"))).toBe(true);
    expect(logs.some((line) => line.includes("No commands found"))).toBe(true);
  });

  it("exits with user error code when rule/skill/agent/command queries return user errors", async () => {
    await mkdir(resolve(configRootPath, "rules"), { recursive: true });
    await mkdir(resolve(configRootPath, "skills"), { recursive: true });
    await mkdir(resolve(configRootPath, "agents"), { recursive: true });
    await mkdir(resolve(configRootPath, "commands"), { recursive: true });

    await withPatchedExecute(
      ListRulesQuery,
      async () => ({ success: false, error: new UserError("rule-failed") }),
      async () => {
        await expect(createRuleCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
      }
    );
    await withPatchedExecute(
      ListSkillsQuery,
      async () => ({ success: false, error: new UserError("skill-failed") }),
      async () => {
        await expect(createSkillCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
      }
    );
    await withPatchedExecute(
      ListAgentsQuery,
      async () => ({ success: false, error: new UserError("agent-failed") }),
      async () => {
        await expect(createAgentCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
      }
    );
    await withPatchedExecute(
      ListCommandsQuery,
      async () => ({ success: false, error: new UserError("command-failed") }),
      async () => {
        await expect(createCommandCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
      }
    );

    expect(errors.some((line) => line.includes("rule-failed"))).toBe(true);
    expect(errors.some((line) => line.includes("skill-failed"))).toBe(true);
    expect(errors.some((line) => line.includes("agent-failed"))).toBe(true);
    expect(errors.some((line) => line.includes("command-failed"))).toBe(true);
  });

  it("exits with fallback code for unexpected query errors in rule/skill/agent/command ls", async () => {
    await mkdir(resolve(configRootPath, "rules"), { recursive: true });
    await mkdir(resolve(configRootPath, "skills"), { recursive: true });
    await mkdir(resolve(configRootPath, "agents"), { recursive: true });
    await mkdir(resolve(configRootPath, "commands"), { recursive: true });

    await withPatchedExecute(
      ListRulesQuery,
      async () => ({ success: false, error: new Error("rule-boom") }),
      async () => {
        await expect(createRuleCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:2");
      }
    );
    await withPatchedExecute(
      ListSkillsQuery,
      async () => ({ success: false, error: new Error("skill-boom") }),
      async () => {
        await expect(createSkillCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:2");
      }
    );
    await withPatchedExecute(
      ListAgentsQuery,
      async () => ({ success: false, error: new Error("agent-boom") }),
      async () => {
        await expect(createAgentCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:2");
      }
    );
    await withPatchedExecute(
      ListCommandsQuery,
      async () => ({ success: false, error: new Error("command-boom") }),
      async () => {
        await expect(createCommandCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:2");
      }
    );

    expect(errors.some((line) => line.includes("Unexpected error"))).toBe(true);
  });

  it("exits when directories are missing for rule/skill/agent/command ls", async () => {
    await expect(createRuleCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createSkillCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createAgentCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createCommandCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");

    expect(errors.some((line) => line.includes("rules/ directory not found"))).toBe(true);
    expect(errors.some((line) => line.includes("skills/ directory not found"))).toBe(true);
    expect(errors.some((line) => line.includes("agents/ directory not found"))).toBe(true);
    expect(errors.some((line) => line.includes("commands/ directory not found"))).toBe(true);
  });

  it("renders non-json mcp ls output including issues", async () => {
    const mcpDir = resolve(configRootPath, "mcps");
    await mkdir(mcpDir, { recursive: true });
    await writeFile(
      resolve(mcpDir, "servers.json"),
      JSON.stringify(
        {
          mcpServers: {
            local: {
              command: "node",
              args: ["server.js"],
            },
            broken: "not-an-object",
          },
        },
        null,
        2
      )
    );

    await createMcpCommand().parseAsync(["node", "test", "ls"]);

    expect(logs.some((line) => line.includes("MCP servers (1):"))).toBe(true);
    expect(logs.some((line) => line.includes("  local"))).toBe(true);
    expect(logs.some((line) => line.includes("Issues:"))).toBe(true);
  });

  it("renders empty non-json mcp ls output", async () => {
    await mkdir(resolve(configRootPath, "mcps"), { recursive: true });
    await createMcpCommand().parseAsync(["node", "test", "ls"]);

    expect(logs.some((line) => line.includes("No MCP servers found"))).toBe(true);
  });

  it("exits when mcps directory is missing", async () => {
    await expect(createMcpCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    expect(errors.some((line) => line.includes("mcps/ directory not found"))).toBe(true);
  });

  it("handles mcp ls user and unexpected query errors", async () => {
    await mkdir(resolve(configRootPath, "mcps"), { recursive: true });

    await withPatchedExecute(
      ListMcpServersQuery,
      async () => ({ success: false, error: new UserError("mcp-failed") }),
      async () => {
        await expect(createMcpCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
      }
    );

    await withPatchedExecute(
      ListMcpServersQuery,
      async () => ({ success: false, error: new Error("mcp-boom") }),
      async () => {
        await expect(createMcpCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:2");
      }
    );

    expect(errors.some((line) => line.includes("mcp-failed"))).toBe(true);
    expect(errors.some((line) => line.includes("Unexpected error"))).toBe(true);
  });
});

async function withPatchedExecute<T extends { prototype: { execute: (...args: never[]) => unknown } }>(
  klass: T,
  impl: (...args: never[]) => unknown,
  run: () => Promise<void>
): Promise<void> {
  const original = klass.prototype.execute;
  klass.prototype.execute = impl;
  try {
    await run();
  } finally {
    klass.prototype.execute = original;
  }
}

async function mkdirTempDir(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}
