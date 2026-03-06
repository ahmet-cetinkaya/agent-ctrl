import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class AntigravityAdapter extends BaseTextAppyAdapter {
  readonly platformName = "antigravity" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  constructor() {
    super();
  }

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".antigravity/rules/appy.md",
      userRelativePath: "antigravity/rules/appy.md",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "# Rule: appy",
      "",
      "Managed rule/workflow style appy integration.",
      "",
      "When applying project configuration, use:",
      "```bash",
      "agent-ctrl apply antigravity",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: rules-workflows-skills",
    ].join("\n");
  }
}
