import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class GeminiAdapter extends BaseTextAppyAdapter {
  readonly platformName = "gemini" as const;

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".gemini/commands/appy.toml",
      userRelativePath: "gemini/commands/appy.toml",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      'name = "appy"',
      'description = "Managed appy command"',
      'prompt = "Run agent-ctrl apply gemini for this project. {{args}}"',
      `scope = "${target.scope}"`,
      'managed_by = "agent-ctrl"',
    ].join("\n");
  }
}
