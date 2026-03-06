import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class WindsurfAdapter extends BaseTextAppyAdapter {
  readonly platformName = "windsurf" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".windsurf/rules/appy.md",
      userRelativePath: "windsurf/rules/appy.md",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "# appy rule",
      "",
      "Managed Windsurf rule/workflow instruction:",
      "",
      "```bash",
      "agent-ctrl apply windsurf",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: rules-workflows",
    ].join("\n");
  }
}
