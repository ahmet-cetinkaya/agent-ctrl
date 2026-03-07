import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class QwenAdapter extends BaseTextAppyAdapter {
  readonly platformName = "qwen" as const;

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".qwen/commands/appy.toml",
      userRelativePath: "qwen/commands/appy.toml",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      'name = "appy"',
      'description = "Managed appy command"',
      'prompt = "Run agent-ctrl apply qwen for this project. {{args}}"',
      `scope = "${target.scope}"`,
      'managed_by = "agent-ctrl"',
    ].join("\n");
  }
}
