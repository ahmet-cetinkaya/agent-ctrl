import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class OpenCodeAdapter extends BaseTextAppyAdapter {
  readonly platformName = "opencode" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  async resolveTarget(projectPath: string): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".opencode/commands/appy.md",
      userRelativePath: ".opencode/commands/appy.md",
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
