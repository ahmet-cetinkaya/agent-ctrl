import type { Artifact } from "@/core/domain/shared/types/Artifact";
import type { IPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";
import { AgentScanner } from "@/infrastructure/features/agent/scanners/AgentScanner";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ClaudeAdapter } from "@/infrastructure/features/claude/adapters/ClaudeAdapter";

export interface ApplyCommandOptions {
  projectPath: string;
  platform: string;
  dryRun?: boolean;
  override?: boolean;
}

export interface ApplyCommandResult {
  rulesApplied: number;
  skillsApplied: number;
  agentsApplied: number;
  configPath: string;
  warnings: string[];
}

export class ApplyCommand {
  async execute(options: ApplyCommandOptions): Promise<Result<ApplyCommandResult, Error>> {
    const { projectPath, platform, dryRun, override } = options;

    const adapter = this.createAdapter(platform, projectPath);
    if (!adapter) {
      return err(new UserError(`Platform '${platform}' not supported. Supported platforms: claude`));
    }

    const artifacts = await this.scanArtifacts(projectPath);
    const warnings: string[] = [];

    if (artifacts.length === 0) {
      warnings.push("No artifacts found in project. Configuration file will be created anyway.");
    }

    const newConfig = await adapter.generateConfig(artifacts);

    const existingConfig = await adapter.readExistingConfig();

    const finalConfig = override ? newConfig : adapter.mergeConfigs(existingConfig, newConfig);

    if (dryRun) {
      return ok({
        rulesApplied: newConfig.rules.length,
        skillsApplied: newConfig.skills.length,
        agentsApplied: newConfig.agents.length,
        configPath: adapter.configPath,
        warnings,
      });
    }

    try {
      await adapter.writeConfig(finalConfig, { cleanExistingArtifacts: Boolean(override) });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return err(new SystemError(`Permission denied: cannot write to ${adapter.configPath}`));
      }
      if ((error as NodeJS.ErrnoException).code === "EBUSY") {
        return err(new SystemError(`Configuration file is locked or in use. Close Claude Code and try again.`));
      }
      return err(new SystemError(`Failed to write configuration: ${error}`));
    }

    return ok({
      rulesApplied: newConfig.rules.length,
      skillsApplied: newConfig.skills.length,
      agentsApplied: newConfig.agents.length,
      configPath: adapter.configPath,
      warnings,
    });
  }

  private createAdapter(platform: string, projectPath: string): IPlatformAdapter | null {
    if (platform === "claude") {
      return new ClaudeAdapter(projectPath);
    }
    return null;
  }

  private async scanArtifacts(projectPath: string): Promise<Artifact[]> {
    const artifacts: Artifact[] = [];

    const ruleScanner = new RuleScanner();
    const skillScanner = new SkillScanner();
    const agentScanner = new AgentScanner();

    const rulesResult = await ruleScanner.scan(`${projectPath}/rules`);
    artifacts.push(...rulesResult.artifacts);

    const skillsResult = await skillScanner.scan(`${projectPath}/skills`);
    artifacts.push(...skillsResult.artifacts);

    const agentsResult = await agentScanner.scan(`${projectPath}/agents`);
    artifacts.push(...agentsResult.artifacts);

    return artifacts;
  }
}
