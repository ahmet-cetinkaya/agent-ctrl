import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class GeminiAdapter extends BaseTextAppyAdapter {
  readonly platformName = "gemini" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  async resolveTarget(projectPath: string): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".gemini/commands/appy.toml",
      userRelativePath: ".gemini/commands/appy.toml",
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
