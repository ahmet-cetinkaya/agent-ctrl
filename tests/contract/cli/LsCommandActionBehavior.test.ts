import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
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
import { captureConsole, cleanupTempDir, createTempConfigRoot } from "../../helpers/catalogTestUtils";

describe("LS command action behavior", () => {
  let homePath: string;
  let configRootPath: string;
  let originalAgentCtrlHome: string | undefined;
  let consoleCapture: ReturnType<typeof captureConsole>;

  beforeEach(async () => {
    const temp = await createTempConfigRoot("ls-cli-action-");
    homePath = temp.baseDir;
    configRootPath = temp.configRoot;

    originalAgentCtrlHome = process.env.AGENT_CTRL_HOME;
    process.env.AGENT_CTRL_HOME = homePath;

    consoleCapture = captureConsole();
  });

  afterEach(async () => {
    consoleCapture.restore();
    if (originalAgentCtrlHome === undefined) {
      delete process.env.AGENT_CTRL_HOME;
    } else {
      process.env.AGENT_CTRL_HOME = originalAgentCtrlHome;
    }
    await cleanupTempDir(homePath);
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

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("Rules (1):")).toBe(true);
    expect(allOutput.includes("my-rule")).toBe(true);
    expect(allOutput.includes("Skills (1):")).toBe(true);
    expect(allOutput.includes("my-skill")).toBe(true);
    expect(allOutput.includes("Agents (1):")).toBe(true);
    expect(allOutput.includes("my-agent")).toBe(true);
    expect(allOutput.includes("Commands (1):")).toBe(true);
    expect(allOutput.includes("explain")).toBe(true);
    expect(allOutput.includes("Warnings:")).toBe(true);
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

    expect(consoleCapture.logs.some((line) => line.includes('"artifacts"'))).toBe(true);
    expect(consoleCapture.logs.some((line) => line.includes('"servers"'))).toBe(true);
    expect(consoleCapture.logs.some((line) => line.includes('"configRoot"'))).toBe(true);
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

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("No rules found")).toBe(true);
    expect(allOutput.includes("No skills found")).toBe(true);
    expect(allOutput.includes("No agents found")).toBe(true);
    expect(allOutput.includes("No commands found")).toBe(true);
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

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("rule-failed")).toBe(true);
    expect(allOutput.includes("skill-failed")).toBe(true);
    expect(allOutput.includes("agent-failed")).toBe(true);
    expect(allOutput.includes("command-failed")).toBe(true);
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

    const allOutput2 = consoleCapture.logs.join(" ");
    expect(allOutput2.includes("Unexpected error")).toBe(true);
  });

  it("exits when directories are missing for rule/skill/agent/command ls", async () => {
    await rm(resolve(configRootPath, "rules"), { recursive: true, force: true });
    await rm(resolve(configRootPath, "skills"), { recursive: true, force: true });
    await rm(resolve(configRootPath, "agents"), { recursive: true, force: true });
    await rm(resolve(configRootPath, "commands"), { recursive: true, force: true });

    await expect(createRuleCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createSkillCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createAgentCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    await expect(createCommandCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("rules/ directory not found")).toBe(true);
    expect(allOutput.includes("skills/ directory not found")).toBe(true);
    expect(allOutput.includes("agents/ directory not found")).toBe(true);
    expect(allOutput.includes("commands/ directory not found")).toBe(true);
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

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("MCP servers (1):")).toBe(true);
    expect(allOutput.includes("  local")).toBe(true);
    expect(allOutput.includes("Issues:")).toBe(true);
  });

  it("renders empty non-json mcp ls output", async () => {
    await mkdir(resolve(configRootPath, "mcps"), { recursive: true });
    await createMcpCommand().parseAsync(["node", "test", "ls"]);

    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("No MCP servers found")).toBe(true);
  });

  it("exits when mcps directory is missing", async () => {
    await rm(resolve(configRootPath, "mcps"), { recursive: true, force: true });

    await expect(createMcpCommand().parseAsync(["node", "test", "ls"])).rejects.toThrow("EXIT:1");
    const allOutput = consoleCapture.logs.join(" ");
    expect(allOutput.includes("mcps/ directory not found")).toBe(true);
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

    const allOutput3 = consoleCapture.logs.join(" ");
    expect(allOutput3.includes("mcp-failed")).toBe(true);
    expect(allOutput3.includes("Unexpected error")).toBe(true);
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

