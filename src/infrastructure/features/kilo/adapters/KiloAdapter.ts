import { CommandScopePrecedenceResolver } from "@/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver";
import { BaseTextAppyAdapter } from "@/infrastructure/features/apply/adapters/BaseTextAppyAdapter";
import type { AppyConfigTarget, AppyIntegrationRequest } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export class KiloAdapter extends BaseTextAppyAdapter {
  readonly platformName = "kilo" as const;

  private readonly scopeResolver = new CommandScopePrecedenceResolver();

  constructor() {
    super();
  }

  async resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget> {
    return this.scopeResolver.resolve({
      platform: this.platformName,
      projectPath,
      projectRelativePath: ".kilocode/workflows/appy.md",
      userRelativePath: "kilo/workflows/appy.md",
      preferredScope: request?.targetScope,
      userConfigRootPath: request?.userConfigRootPath,
    });
  }

  protected buildDesiredContent(target: AppyConfigTarget): string {
    return [
      "# Workflow: appy",
      "",
      "Managed workflow for appy integration.",
      "",
      "```bash",
      "agent-ctrl apply kilo",
      "```",
      "",
      `Scope: ${target.scope}`,
      "Surface: workflow",
    ].join("\n");
  }
}
