import { getPlatformDisplayName } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

/** Claude tier aliases are only valid in Claude Code; other platforms need a `provider/model` route. */
const CLAUDE_TIER_ALIASES: ReadonlySet<string> = new Set(["sonnet", "opus", "haiku"]);

/** Platforms whose model field is a `provider/model` route, so a bare tier alias is invalid there. */
const ROUTED_PLATFORMS: ReadonlySet<SupportedApplyPlatform> = new Set(["opencode", "kilo"]);

export const MODEL_ALIAS_ENV_PREFIX = "AGENT_CTRL_";

export interface ModelAliasNormalization {
  value?: string;
  warning?: string;
}

export function modelAliasEnvName(platform: SupportedApplyPlatform, alias: string): string {
  return `${MODEL_ALIAS_ENV_PREFIX}${platform.toUpperCase()}_MODEL_${alias.toUpperCase()}`;
}

/**
 * Maps a bare Claude tier alias to the route configured through
 * `AGENT_CTRL_<PLATFORM>_MODEL_<ALIAS>`. Any other value passes through unchanged.
 * An unmapped alias yields no value so the platform default applies instead of an invalid route.
 */
export function normalizeModelAlias(
  value: string,
  platform: SupportedApplyPlatform,
  env: Record<string, string | undefined>
): ModelAliasNormalization {
  const alias = value.trim().toLowerCase();
  if (!ROUTED_PLATFORMS.has(platform) || !CLAUDE_TIER_ALIASES.has(alias)) {
    return { value };
  }

  const envName = modelAliasEnvName(platform, alias);
  const route = env[envName]?.trim();
  if (route) {
    return { value: route };
  }
  return {
    warning: `model: dropped — '${value}' is a Claude alias and ${getPlatformDisplayName(platform)} needs a provider/model route; set ${envName} (or use \`models.${platform}\`).`,
  };
}
