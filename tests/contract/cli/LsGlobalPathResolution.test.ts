import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

describe("LS command path resolution", () => {
  let homePath: string;
  let customRootPath: string;
  let originalAgentCtrlHome: string | undefined;
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalRuleExecute: ListRulesQuery["execute"];
  let originalSkillExecute: ListSkillsQuery["execute"];
  let originalAgentExecute: ListAgentsQuery["execute"];
  let originalCommandExecute: ListCommandsQuery["execute"];
  let originalMcpExecute: ListMcpServersQuery["execute"];

  const captured: {
    rulesPath?: string;
    skillsPath?: string;
    agentsPath?: string;
    commandsPath?: string;
    projectPath?: string;
  } = {};

  beforeEach(async () => {
    homePath = await mkdtemp(join(tmpdir(), "agent-ctrl-home-"));
    customRootPath = resolve(homePath, "custom-root");

    originalAgentCtrlHome = process.env.AGENT_CTRL_HOME;
    process.env.AGENT_CTRL_HOME = homePath;

    await mkdir(resolve(homePath, ".agent-ctrl", "rules"), { recursive: true });
    await mkdir(resolve(homePath, ".agent-ctrl", "skills"), { recursive: true });
    await mkdir(resolve(homePath, ".agent-ctrl", "agents"), { recursive: true });
    await mkdir(resolve(homePath, ".agent-ctrl", "commands"), { recursive: true });
    await mkdir(resolve(homePath, ".agent-ctrl", "mcps"), { recursive: true });

    await mkdir(resolve(customRootPath, "rules"), { recursive: true });
    await mkdir(resolve(customRootPath, "skills"), { recursive: true });
    await mkdir(resolve(customRootPath, "agents"), { recursive: true });
    await mkdir(resolve(customRootPath, "commands"), { recursive: true });
    await mkdir(resolve(customRootPath, "mcps"), { recursive: true });

    originalLog = console.log;
    originalError = console.error;
    console.log = () => {};
    console.error = () => {};

    originalRuleExecute = ListRulesQuery.prototype.execute;
    originalSkillExecute = ListSkillsQuery.prototype.execute;
    originalAgentExecute = ListAgentsQuery.prototype.execute;
    originalCommandExecute = ListCommandsQuery.prototype.execute;
    originalMcpExecute = ListMcpServersQuery.prototype.execute;

    ListRulesQuery.prototype.execute = async function mockedExecute(options) {
      captured.rulesPath = options.rulesPath;
      return {
        success: true,
        data: {
          artifacts: [],
          warnings: [],
        },
      };
    };

    ListSkillsQuery.prototype.execute = async function mockedExecute(options) {
      captured.skillsPath = options.skillsPath;
      return {
        success: true,
        data: {
          artifacts: [],
          warnings: [],
          catalogState: {
            managedById: new Map(),
            catalogById: new Map(),
          },
        },
      };
    };

    ListAgentsQuery.prototype.execute = async function mockedExecute(options) {
      captured.agentsPath = options.agentsPath;
      return {
        success: true,
        data: {
          artifacts: [],
          warnings: [],
        },
      };
    };

    ListCommandsQuery.prototype.execute = async function mockedExecute(options) {
      captured.commandsPath = options.commandsPath;
      return {
        success: true,
        data: {
          artifacts: [],
          warnings: [],
        },
      };
    };

    ListMcpServersQuery.prototype.execute = async function mockedExecute(options) {
      captured.projectPath = options.projectPath;
      return {
        success: true,
        data: {
          servers: [],
          report: {
            startedAt: "",
            finishedAt: "",
            totalDiscovered: 0,
            totalLoaded: 0,
            totalSkipped: 0,
            totalFailed: 0,
            fileResults: [],
          },
          catalogState: {
            managedById: new Map(),
            catalogById: new Map(),
          },
        },
      };
    };
  });

  afterEach(async () => {
    ListRulesQuery.prototype.execute = originalRuleExecute;
    ListSkillsQuery.prototype.execute = originalSkillExecute;
    ListAgentsQuery.prototype.execute = originalAgentExecute;
    ListCommandsQuery.prototype.execute = originalCommandExecute;
    ListMcpServersQuery.prototype.execute = originalMcpExecute;

    console.log = originalLog;
    console.error = originalError;

    if (originalAgentCtrlHome === undefined) {
      delete process.env.AGENT_CTRL_HOME;
    } else {
      process.env.AGENT_CTRL_HOME = originalAgentCtrlHome;
    }

    await rm(homePath, { recursive: true, force: true });
  });

  it("uses default ~/.agent-ctrl when path is not provided", async () => {
    const defaultRoot = resolve(homePath, ".agent-ctrl");

    await createRuleCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createSkillCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createAgentCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createCommandCommand().parseAsync(["node", "test", "ls", "--json"]);
    await createMcpCommand().parseAsync(["node", "test", "ls", "--json"]);

    expect(captured.rulesPath).toBe(resolve(defaultRoot, "rules"));
    expect(captured.skillsPath).toBe(resolve(defaultRoot, "skills"));
    expect(captured.agentsPath).toBe(resolve(defaultRoot, "agents"));
    expect(captured.commandsPath).toBe(resolve(defaultRoot, "commands"));
    expect(captured.projectPath).toBe(defaultRoot);
  });

  it("uses provided path argument when present", async () => {
    await createRuleCommand().parseAsync(["node", "test", "ls", customRootPath, "--json"]);
    await createSkillCommand().parseAsync(["node", "test", "ls", customRootPath, "--json"]);
    await createAgentCommand().parseAsync(["node", "test", "ls", customRootPath, "--json"]);
    await createCommandCommand().parseAsync(["node", "test", "ls", customRootPath, "--json"]);
    await createMcpCommand().parseAsync(["node", "test", "ls", customRootPath, "--json"]);

    expect(captured.rulesPath).toBe(resolve(customRootPath, "rules"));
    expect(captured.skillsPath).toBe(resolve(customRootPath, "skills"));
    expect(captured.agentsPath).toBe(resolve(customRootPath, "agents"));
    expect(captured.commandsPath).toBe(resolve(customRootPath, "commands"));
    expect(captured.projectPath).toBe(customRootPath);
  });
});
