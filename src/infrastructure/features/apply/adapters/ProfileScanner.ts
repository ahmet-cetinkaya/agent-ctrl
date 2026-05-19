import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { ApplyMcpServer, ApplySourceSnapshot } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { CommandScanner } from "@/infrastructure/features/command/scanners/CommandScanner";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

export class ProfileScanner {
  private readonly ruleScanner = new RuleScanner();
  private readonly skillScanner = new SkillScanner();
  private readonly agentScanner = new AgentScanner();
  private readonly commandScanner = new CommandScanner();
  private readonly mcpLoader = new McpServerAggregator();

  async scan(profilePath: string): Promise<ApplySourceSnapshot> {
    await this.assertProfileDirectory(profilePath);

    const rulesPath = resolve(profilePath, "rules");
    const skillsPath = resolve(profilePath, "skills");
    const agentsPath = resolve(profilePath, "agents");
    const commandsPath = resolve(profilePath, "commands");

    const rulesResult = await this.loadRulesIfExists(rulesPath);
    const skillsResult = await this.loadSkillsIfExists(skillsPath);
    const agentsResult = await this.loadAgentsIfExists(agentsPath);
    const commandResult = await this.loadCommandsIfExists(commandsPath);
    const mcpResult = await this.loadMcpIfExists(profilePath);

    const warnings: string[] = [
      ...rulesResult.warnings,
      ...skillsResult.warnings,
      ...agentsResult.warnings,
      ...commandResult.warnings,
      ...mcpResult.warnings,
    ];

    return {
      rules: rulesResult.artifacts,
      skills: skillsResult.artifacts,
      agents: agentsResult.artifacts,
      commands: commandResult.artifacts,
      mcpServers: mcpResult.servers,
      warnings,
    };
  }

  private async assertProfileDirectory(profilePath: string): Promise<void> {
    try {
      const stats = await stat(profilePath);
      if (!stats.isDirectory()) {
        throw new Error(`Profile path is not a directory: ${profilePath}`);
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        throw new Error(`Profile directory does not exist: ${profilePath}`);
      }
      throw error;
    }
  }

  private async loadRulesIfExists(path: string): Promise<{ artifacts: Rule[]; warnings: string[] }> {
    if (!(await this.directoryExists(path))) {
      return { artifacts: [], warnings: [] };
    }
    return this.ruleScanner.scan(path);
  }

  private async loadSkillsIfExists(path: string): Promise<{ artifacts: Skill[]; warnings: string[] }> {
    if (!(await this.directoryExists(path))) {
      return { artifacts: [], warnings: [] };
    }
    return this.skillScanner.scan(path);
  }

  private async loadAgentsIfExists(path: string): Promise<{ artifacts: Agent[]; warnings: string[] }> {
    if (!(await this.directoryExists(path))) {
      return { artifacts: [], warnings: [] };
    }
    return this.agentScanner.scan(path);
  }

  private async loadCommandsIfExists(path: string): Promise<{ artifacts: CommandArtifact[]; warnings: string[] }> {
    if (!(await this.directoryExists(path))) {
      return { artifacts: [], warnings: [] };
    }
    return this.commandScanner.scan(path);
  }

  private async loadMcpIfExists(profilePath: string): Promise<{ servers: ApplyMcpServer[]; warnings: string[] }> {
    const mcpsPath = resolve(profilePath, "mcps");
    if (!(await this.directoryExists(mcpsPath))) {
      return { servers: [], warnings: [] };
    }

    try {
      const result = await this.mcpLoader.load(profilePath);
      if (!result.success) {
        return { servers: [], warnings: [`MCP load failed: ${result.error.message}`] };
      }

      const servers: ApplyMcpServer[] = result.data.servers.map((server) => {
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
      });

      const warnings = result.data.report.fileResults.flatMap((file) =>
        file.issues.map((issue) => `${issue.code}: ${issue.message} (${issue.filePath})`)
      );

      return { servers, warnings };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { servers: [], warnings: [`MCP load failed: ${message}`] };
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
