import { homedir } from "node:os";
import { resolve } from "node:path";
import type { ApplyPlatformScope, AppyConfigTarget } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export interface CommandScopeResolutionOptions {
  platform: SupportedApplyPlatform;
  projectPath: string;
  projectRelativePath: string;
  userRelativePath: string;
}

export class CommandScopePrecedenceResolver {
  private readonly homePath: string;

  constructor(homePath?: string) {
    this.homePath = homePath ?? process.env.AGENT_CTRL_HOME ?? homedir();
  }

  resolve(options: CommandScopeResolutionOptions): AppyConfigTarget {
    const { platform, projectPath, projectRelativePath, userRelativePath } = options;

    const userPath = resolve(this.homePath, userRelativePath);
    const projectConfigPath = resolve(projectPath, projectRelativePath);

    if (this.shouldUseUserScope(platform)) {
      return {
        configPath: userPath,
        scope: "user",
        surface: this.getSurface(platform),
      };
    }

    return {
      configPath: projectConfigPath,
      scope: "project",
      surface: this.getSurface(platform),
    };
  }

  private shouldUseUserScope(platform: SupportedApplyPlatform): boolean {
    const explicitScope = (process.env.AGENT_CTRL_APPLY_SCOPE ?? "").toLowerCase();
    if (explicitScope === "user") {
      return true;
    }
    if (explicitScope === "project") {
      return false;
    }

    if (platform === "codex") {
      const trustedProject = (process.env.AGENT_CTRL_CODEX_TRUSTED_PROJECT ?? "true").toLowerCase();
      if (trustedProject === "false") {
        return true;
      }
    }

    if (platform === "cursor") {
      return (process.env.AGENT_CTRL_CURSOR_SCOPE ?? "").toLowerCase() === "user";
    }

    if (platform === "windsurf") {
      return (process.env.AGENT_CTRL_WINDSURF_SCOPE ?? "").toLowerCase() === "global";
    }

    return false;
  }

  private getSurface(platform: SupportedApplyPlatform): string {
    switch (platform) {
      case "opencode":
        return "commands";
      case "gemini":
      case "qwen":
        return "commands-toml";
      case "kilo":
        return "workflow";
      case "antigravity":
        return "rules-workflows-skills";
      case "codex":
        return "config-skills-agent-guidance";
      case "cursor":
        return "rules";
      case "windsurf":
        return "rules-workflows";
      default:
        return "configuration";
    }
  }
}
