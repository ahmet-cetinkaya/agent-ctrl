import { homedir } from "node:os";
import { resolve } from "node:path";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IAppyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  mergeJsonObjectFile,
  renderOpencodeMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsMarkdown,
  syncRulesAsFiles,
  syncSkills,
  toStatus,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";

export class KiloAdapter implements IAppyPlatformAdapter {
  readonly platformName = "kilo" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath
      ? resolve(request.userConfigRootPath)
      : resolve(homedir(), ".kilocode");

    return {
      configPath: scope === "project" ? resolve(projectPath, ".kilocode") : userRoot,
      scope,
      surface: "rules-workflows-skills-agents-mcp",
    };
  }

  async applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult> {
    const target = await this.resolveTarget(request.projectPath, request);
    const source = await this.sourceLoader.load(request.projectPath);
    let changed = false;
    const fileChanges: string[] = [];

    const rulesResult = await syncRulesAsFiles(
      source.rules,
      resolve(target.configPath, "rules"),
      (rule, content) => ({ relativePath: `${rule.id}.md`, content: content.trimEnd() }),
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    const workflowsResult = await syncCommandsAsMarkdown(
      source.commands,
      resolve(target.configPath, "workflows"),
      Boolean(request.dryRun),
      CommandRendererFactory.getRenderer("workflow"),
      "-"
    );
    changed = workflowsResult.changed || changed;
    fileChanges.push(...workflowsResult.paths);

    const skillsResult = await syncSkills(source.skills, resolve(target.configPath, "skills"), Boolean(request.dryRun));
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    const agentsResult = await syncAgentsAsMarkdown(
      source.agents,
      resolve(target.configPath, "agents"),
      Boolean(request.dryRun),
      true
    );
    changed = agentsResult.changed || changed;
    fileChanges.push(...agentsResult.paths);

    const mcpResult = await mergeJsonObjectFile(
      resolve(target.configPath, "kilo.json"),
      (existing) => renderOpencodeMcpConfig(existing, source.mcpServers),
      Boolean(request.dryRun)
    );
    changed = mcpResult.changed || changed;
    fileChanges.push(...mcpResult.paths);

    return {
      platform: this.platformName,
      configPath: target.configPath,
      scope: target.scope,
      surface: target.surface,
      status: toStatus(changed),
      message: "Applied Kilo rules, workflows, skills, agents, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
