import { homedir } from "node:os";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
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
  syncCommandsAsMarkdown,
  syncRulesAsFiles,
  syncSkills,
  toStatus,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";

const KILO_VSCODE_DIR = ".kilo";
const KILO_CLI_DIR = ".kilocode";

function getKiloConfigRoots(basePath: string): string[] {
  return [resolve(basePath, KILO_VSCODE_DIR), resolve(basePath, KILO_CLI_DIR)];
}

async function ensureDirExists(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export class KiloAdapter implements IApplyPlatformAdapter {
  readonly platformName = "kilo" as const;
  private readonly sourceLoader = new ApplySourceLoader();

  async resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const targetPath = scope === "project" ? projectPath : (request?.userConfigRootPath ?? resolve(homedir()));

    const [vscodeRoot, cliRoot] = getKiloConfigRoots(targetPath);

    await ensureDirExists(vscodeRoot);
    await ensureDirExists(cliRoot);

    return {
      configPath: vscodeRoot,
      scope,
      surface: "rules-workflows-skills-agents-mcp",
    };
  }

  async applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult> {
    const scope = resolveApplyScope(request?.targetScope, "user", true);
    const targetPath = scope === "project" ? request.projectPath : (request?.userConfigRootPath ?? resolve(homedir()));

    const targetRoots = getKiloConfigRoots(targetPath);
    const source = await this.sourceLoader.load(request.projectPath);
    let changed = false;
    const fileChanges: string[] = [];

    for (const targetRoot of targetRoots) {
      const rulesResult = await syncRulesAsFiles(
        source.rules,
        resolve(targetRoot, "rules"),
        (rule, content) => ({ relativePath: `${rule.id}.md`, content: content.trimEnd() }),
        Boolean(request.dryRun)
      );
      changed = rulesResult.changed || changed;
      fileChanges.push(...rulesResult.paths);

      const workflowsResult = await syncCommandsAsMarkdown(
        source.commands,
        resolve(targetRoot, "commands"),
        Boolean(request.dryRun),
        CommandRendererFactory.getRenderer("workflow"),
        ":"
      );
      changed = workflowsResult.changed || changed;
      fileChanges.push(...workflowsResult.paths);

      const skillsResult = await syncSkills(source.skills, resolve(targetRoot, "skills"), Boolean(request.dryRun));
      changed = skillsResult.changed || changed;
      fileChanges.push(...skillsResult.paths);

      const agentsResult = await syncAgentsAsMarkdown(
        source.agents,
        resolve(targetRoot, "agents"),
        Boolean(request.dryRun),
        true
      );
      changed = agentsResult.changed || changed;
      fileChanges.push(...agentsResult.paths);

      const mcpResult = await mergeJsonObjectFile(
        resolve(targetRoot, "kilo.json"),
        (existing) => renderOpencodeMcpConfig(existing, source.mcpServers),
        Boolean(request.dryRun)
      );
      changed = mcpResult.changed || changed;
      fileChanges.push(...mcpResult.paths);
    }

    return {
      platform: this.platformName,
      configPath: targetRoots.join(", "),
      scope,
      surface: "rules-workflows-skills-agents-mcp",
      status: toStatus(changed),
      message:
        "Applied Kilo rules, workflows, skills, agents, and MCP servers to both .kilo and .kilocode directories.",
      fileChanges,
      warnings: source.warnings,
    };
  }
}
