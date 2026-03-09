import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { CommandScanner, type CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

export interface ApplyMcpServer {
  name: string;
  transport: "stdio" | "http";
  // Stdio transport fields
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // HTTP transport fields
  url?: string;
  sourceFile: string;
}

export interface ApplySourceSnapshot {
  rules: Rule[];
  skills: Skill[];
  agents: Agent[];
  commands: CommandArtifact[];
  mcpServers: ApplyMcpServer[];
  warnings: string[];
}

export class ApplySourceLoader {
  private readonly ruleScanner = new RuleScanner();
  private readonly skillScanner = new SkillScanner();
  private readonly agentScanner = new AgentScanner();
  private readonly commandScanner = new CommandScanner();
  private readonly mcpLoader = new McpServerAggregator();

  async load(projectPath: string): Promise<ApplySourceSnapshot> {
    await this.assertProjectDirectory(projectPath);

    const configRoot = resolve(projectPath, ".agent-ctrl");
    const rulesPath = resolve(configRoot, "rules");
    const skillsPath = resolve(configRoot, "skills");
    const agentsPath = resolve(configRoot, "agents");
    const commandsPath = resolve(configRoot, "commands");

    const [ruleResult, skillResult, agentResult, commandResult, mcpResult] = await Promise.all([
      this.loadRules(rulesPath),
      this.loadSkills(skillsPath),
      this.loadAgents(agentsPath),
      this.loadCommands(commandsPath),
      this.mcpLoader.load(projectPath),
    ]);

    if (!mcpResult.success) {
      throw mcpResult.error;
    }

    const warnings = [
      ...ruleResult.warnings,
      ...skillResult.warnings,
      ...agentResult.warnings,
      ...commandResult.warnings,
      ...mcpResult.data.report.fileResults.flatMap((file) =>
        file.issues.map((issue) => `${issue.code}: ${issue.message} (${issue.filePath})`)
      ),
    ];

    return {
      rules: ruleResult.artifacts,
      skills: skillResult.artifacts,
      agents: agentResult.artifacts,
      commands: commandResult.artifacts,
      mcpServers: mcpResult.data.servers.map((server) => {
        if (server.transport === "http") {
          return {
            name: server.serverId,
            transport: "http" as const,
            url: server.url,
            sourceFile: server.filePath,
          };
        }
        return {
          name: server.serverId,
          transport: "stdio" as const,
          command: server.command,
          args: server.args,
          cwd: server.cwd,
          env: server.env,
          sourceFile: server.filePath,
        };
      }),
      warnings,
    };
  }

  private async loadRules(
    rulesPath: string
  ): Promise<ReturnType<RuleScanner["scan"]> extends Promise<infer T> ? T : never> {
    if (!(await this.directoryExists(rulesPath))) {
      return { files: [], artifacts: [], warnings: [] };
    }

    return this.ruleScanner.scan(rulesPath);
  }

  private async loadSkills(
    skillsPath: string
  ): Promise<ReturnType<SkillScanner["scan"]> extends Promise<infer T> ? T : never> {
    if (!(await this.directoryExists(skillsPath))) {
      return { files: [], artifacts: [], warnings: [] };
    }

    return this.skillScanner.scan(skillsPath);
  }

  private async loadAgents(
    agentsPath: string
  ): Promise<ReturnType<AgentScanner["scan"]> extends Promise<infer T> ? T : never> {
    if (!(await this.directoryExists(agentsPath))) {
      return { files: [], artifacts: [], warnings: [] };
    }

    return this.agentScanner.scan(agentsPath);
  }

  private async loadCommands(
    commandsPath: string
  ): Promise<ReturnType<CommandScanner["scan"]> extends Promise<infer T> ? T : never> {
    if (!(await this.directoryExists(commandsPath))) {
      return { artifacts: [], warnings: [] };
    }

    return this.commandScanner.scan(commandsPath);
  }

  private async assertProjectDirectory(projectPath: string): Promise<void> {
    const stats = await stat(projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`Project path must be a directory: ${projectPath}`);
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await stat(path);
      return stats.isDirectory();
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT" || nodeError.code === "ENOTDIR") {
        return false;
      }
      throw error;
    }
  }
}
