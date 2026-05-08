import { homedir } from "node:os";
import { resolve } from "node:path";
import type {
  AppyConfigTarget,
  AppyIntegrationRequest,
  AppyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  mergeJsonObjectFile,
  renderSettingsMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsMarkdown,
  syncRulesAsFiles,
  syncSkills,
  toStatus,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

export class CursorAdapter implements IApplyPlatformAdapter {
  readonly platformName = "cursor" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const userRoot = request?.userConfigRootPath ? resolve(request.userConfigRootPath) : resolve(homedir(), ".cursor");
    return {
      configPath: scope === "project" ? resolve(projectPath, ".cursor") : userRoot,
      scope,
      surface: "rules-skills-commands-agents-mcp",
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
      (rule, content) => ({
        relativePath: `${rule.id}.mdc`,
        content: ["---", `description: ${rule.id}`, "---", "", content.trimEnd()].join("\n"),
      }),
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    const skillsResult = await syncSkills(source.skills, resolve(target.configPath, "skills"), Boolean(request.dryRun));
    changed = skillsResult.changed || changed;
    fileChanges.push(...skillsResult.paths);

    const commandsResult = await syncCommandsAsMarkdown(
      source.commands,
      resolve(target.configPath, "commands"),
      Boolean(request.dryRun)
    );
    changed = commandsResult.changed || changed;
    fileChanges.push(...commandsResult.paths);

    const agentsResult = await syncAgentsAsMarkdown(
      source.agents,
      resolve(target.configPath, "agents"),
      Boolean(request.dryRun),
      true
    );
    changed = agentsResult.changed || changed;
    fileChanges.push(...agentsResult.paths);

    const mcpResult = await mergeJsonObjectFile(
      resolve(target.configPath, "mcp.json"),
      (existing) => renderSettingsMcpConfig(existing, source.mcpServers),
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
      message: "Applied Cursor rules, skills, commands, agents, and MCP servers.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
