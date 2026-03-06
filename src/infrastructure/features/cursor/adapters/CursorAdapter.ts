import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class CursorAdapter extends BaseTextAppyAdapter {
  readonly platformName = "cursor" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  async resolveTarget(projectPath: string): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".cursor/rules/appy.mdc",
      userRelativePath: ".cursor/rules/appy.mdc",
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "---",
      "description: Managed appy rule",
      "alwaysApply: true",
      "---",
      "",
      "Use appy integration for this workspace:",
      "```bash",
      "agent-ctrl apply cursor",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: rules",
    ].join("\n");
  }
}
