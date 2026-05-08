import type { ApplyPlatformScope, ApplyConfigTarget } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export interface CommandScopeResolutionOptions {
  platform: SupportedApplyPlatform;
  projectConfigPath: string;
  userConfigPath?: string;
  preferredScope?: ApplyPlatformScope;
  defaultScope?: ApplyPlatformScope;
}

export class CommandScopePrecedenceResolver {
  resolve(options: CommandScopeResolutionOptions): ApplyConfigTarget {
    const scope = this.resolveScope(options.preferredScope, options.defaultScope ?? "user");

    if (scope === "user") {
      if (!options.userConfigPath) {
        throw new Error(
          `Platform '${options.platform}' does not expose a documented file-backed user configuration surface.`
        );
      }

      return {
        configPath: options.userConfigPath,
        scope: "user",
        surface: this.getSurface(options.platform),
      };
    }

    return {
      configPath: options.projectConfigPath,
      scope: "project",
      surface: this.getSurface(options.platform),
    };
  }

  private resolveScope(
    preferredScope?: ApplyPlatformScope,
    defaultScope: ApplyPlatformScope = "user"
  ): ApplyPlatformScope {
    if (preferredScope === "user") {
      return "user";
    }
    if (preferredScope === "project") {
      return "project";
    }

    const explicitScope = (process.env.AGENT_CTRL_APPLY_SCOPE ?? "").toLowerCase();
    if (explicitScope === "user") {
      return "user";
    }
    if (explicitScope === "project") {
      return "project";
    }

    return defaultScope;
  }

  private getSurface(platform: SupportedApplyPlatform): string {
    switch (platform) {
      case "opencode":
        return "agents-md-commands-skills-agents-mcp";
      case "claude":
        return "memory-skills-agents-mcp";
      case "gemini":
        return "gemini-md-commands-settings";
      case "qwen":
        return "qwen-md-commands-skills-settings";
      case "kilo":
        return "rules-workflows-skills-agents-mcp";
      case "antigravity":
        return "rules-workflows-skills-mcp";
      case "codex":
        return "agents-md-skills-config-toml";
      case "cursor":
        return "rules-skills-commands-agents-mcp";
      case "windsurf":
        return "global-rules-workflows-skills-mcp";
      default:
        return "configuration";
    }
  }
}
