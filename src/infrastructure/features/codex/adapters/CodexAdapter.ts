import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class CodexAdapter extends BaseTextAppyAdapter {
  readonly platformName = "codex" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".codex/skills/appy/SKILL.md",
      userRelativePath: "codex/skills/appy/SKILL.md",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "---",
      "name: appy",
      "description: Managed appy integration skill",
      "---",
      "",
      "Use this skill to configure appy for Codex projects:",
      "",
      "```bash",
      "agent-ctrl apply codex",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: config-skills-agent-guidance",
    ].join("\n");
  }
}
