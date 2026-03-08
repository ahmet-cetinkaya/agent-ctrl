import { resolve } from "node:path";
import { homedir } from "node:os";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
  PlatformConfig,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { Artifact } from "@/core/domain/shared/types/Artifact";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";

export class ClaudeApplyAdapter implements IAppyPlatformAdapter {
  readonly platformName = "claude" as const;
  private readonly ruleScanner = new RuleScanner();
  private readonly skillScanner = new SkillScanner();
  private readonly agentScanner = new AgentScanner();
  private readonly mcpLoader = new McpServerAggregator();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = request?.targetScope ?? "user";
    const claudeRoot =
      scope === "project"
        ? resolve(projectPath, ".claude")
        : resolve(process.env.AGENT_CTRL_CLAUDE_HOME || homedir(), ".claude");

    return {
      configPath: resolve(claudeRoot, "CLAUDE.md"),
      scope,
      surface: "memory-skills-agents-commands-mcp",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const adapter = new ClaudeAdapter(
      request.projectPath,
      target.scope === "project" ? request.projectPath : process.env.AGENT_CTRL_CLAUDE_HOME || homedir()
    );
    const desiredConfig = await this.buildDesiredConfig(request.projectPath, adapter);

    if (!request.dryRun) {
      const writeResult = await adapter.writeConfig(desiredConfig, {
        cleanExistingArtifacts: Boolean(request.override),
      });
      if (!writeResult.success) {
        throw writeResult.error;
      }
    }

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: "success",
      message: "Applied Claude configuration, skills, agents, commands, and MCP servers.",
    };
  }

  private async buildDesiredConfig(projectPath: string, adapter: ClaudeAdapter): Promise<PlatformConfig> {
    const artifacts: Artifact[] = [];
    const configRoot = resolve(projectPath, ".agent-ctrl");
    const ruleResult = await this.ruleScanner.scan(resolve(configRoot, "rules"));
    const skillResult = await this.skillScanner.scan(resolve(configRoot, "skills"));
    const agentResult = await this.agentScanner.scan(resolve(configRoot, "agents"));

    artifacts.push(...ruleResult.artifacts, ...skillResult.artifacts, ...agentResult.artifacts);

    const generated = await adapter.generateConfig(artifacts);
    if (!generated.success) {
      throw generated.error;
    }

    const mcpLoad = await this.mcpLoader.load(projectPath);
    if (!mcpLoad.success) {
      throw new Error(mcpLoad.error.message);
    }

    return {
      ...generated.data,
      mcpServers: mcpLoad.data.servers.map((server) => ({
        name: server.serverId,
        command: server.command,
        args: server.args,
        cwd: server.cwd,
        env: server.env,
        sourceFile: server.filePath,
      })),
    };
  }
}
