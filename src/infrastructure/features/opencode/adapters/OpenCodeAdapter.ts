import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class OpenCodeAdapter extends BaseTextAppyAdapter {
  readonly platformName = "opencode" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  constructor() {
    super();
  }

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".opencode/commands/appy.md",
      userRelativePath: "opencode/commands/appy.md",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "# appy",
      "",
      "Managed by agent-ctrl.",
      "",
      "Run:",
      "```bash",
      "agent-ctrl apply opencode",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: commands",
    ].join("\n");
  }
}
