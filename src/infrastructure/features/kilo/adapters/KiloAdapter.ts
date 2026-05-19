import { homedir } from "node:os";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import type {
  ApplyConfigTarget,
  ApplyIntegrationRequest,
  ApplyIntegrationResult,
  IApplyPlatformAdapter,
} from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ApplySourceLoader } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import {
  mergeJsonObjectFile,
  renderOpencodeMcpConfig,
  resolveApplyScope,
  syncAgentsAsMarkdown,
  syncCommandsAsSkills,
  syncSkills,
  toStatus,
  upsertManagedRuleDocument,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";

const KILO_VSCODE_DIR = ".kilo";
const KILO_CLI_DIR = ".kilocode";

function getKiloConfigRoots(basePath: string): string[] {
  return [resolve(basePath, KILO_VSCODE_DIR), resolve(basePath, KILO_CLI_DIR)];
}

export class KiloAdapter implements IApplyPlatformAdapter {
  readonly platformName = "kilo" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const targetPath =
      scope === "project" ? projectPath : (request?.userConfigRootPath ?? resolve(homedir(), ".config", "kilo"));

    return {
      configPath: resolve(targetPath, "AGENTS.md"),
      scope,
      surface: "rules-skills-agents-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const targetPath =
      scope === "project"
        ? request.projectPath
        : (request?.userConfigRootPath ?? resolve(homedir(), ".config", "kilo"));
    const configPath = resolve(targetPath, "AGENTS.md");

    const targetRoots = getKiloConfigRoots(targetPath);
    const source = request.mergedSnapshot
      ? {
          rules: request.mergedSnapshot.rules,
          skills: request.mergedSnapshot.skills,
          agents: request.mergedSnapshot.agents,
          commands: request.mergedSnapshot.commands,
          mcpServers: request.mergedSnapshot.mcpServers,
          warnings: request.mergedSnapshot.warnings,
        }
      : await this.sourceLoader.load(request.projectPath);
    let changed = false;
    const fileChanges: string[] = [];

    // Clean existing managed artifacts if override is enabled
    if (request.override) {
      for (const targetRoot of targetRoots) {
        const skillsPath = resolve(targetRoot, "skills");
        const agentsPath = resolve(targetRoot, "agents");

        await Promise.all([
          rm(skillsPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
          rm(agentsPath, { recursive: true, force: true }).catch((error) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          }),
        ]);
      }
    }

    const rulesResult = await upsertManagedRuleDocument(
      configPath,
      source.rules,
      { start: "<!-- agent-ctrl:kilo:start -->", end: "<!-- agent-ctrl:kilo:end -->" },
      "No managed Kilo rules were found.",
      Boolean(request.dryRun)
    );
    changed = rulesResult.changed || changed;
    fileChanges.push(...rulesResult.paths);

    for (const targetRoot of targetRoots) {
      // Kilo does not support a native commands directory — write commands as skills instead.
      if (source.commands.length > 0) {
        source.warnings.push(
          "Kilo does not support a commands directory. Commands are being written as skills instead."
        );
        const commandsResult = await syncCommandsAsSkills(
          source.commands,
          resolve(targetRoot, "skills"),
          Boolean(request.dryRun)
        );
        changed = commandsResult.changed || changed;
        fileChanges.push(...commandsResult.paths);
      }

      if (source.skills.length > 0) {
        const skillsResult = await syncSkills(source.skills, resolve(targetRoot, "skills"), Boolean(request.dryRun));
        changed = skillsResult.changed || changed;
        fileChanges.push(...skillsResult.paths);
      }

      if (source.agents.length > 0) {
        const agentsResult = await syncAgentsAsMarkdown(
          source.agents,
          resolve(targetRoot, "agents"),
          Boolean(request.dryRun),
          true
        );
        changed = agentsResult.changed || changed;
        fileChanges.push(...agentsResult.paths);
      }

      if (source.mcpServers.length > 0) {
        const mcpResult = await mergeJsonObjectFile(
          resolve(targetRoot, "kilo.jsonc"),
          (existing) => renderOpencodeMcpConfig(existing, source.mcpServers),
          Boolean(request.dryRun)
        );
        changed = mcpResult.changed || changed;
        fileChanges.push(...mcpResult.paths);
      }
    }

    return {
      platform: this.platformName,
      configPath,
      scope,
      surface: "rules-skills-agents-mcp",
      status: toStatus(changed),
      message:
        "Applied Kilo rules, workflows, skills, agents, and MCP servers to both .kilo and .kilocode directories.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
