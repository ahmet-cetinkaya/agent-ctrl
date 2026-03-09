export const SUPPORTED_APPLY_PLATFORMS = [
  "antigravity",
  "claude",
  "codex",
  "cursor",
  "gemini",
  "kilo",
  "opencode",
  "qwen",
  "windsurf",
] as const;

export type SupportedApplyPlatform = (typeof SUPPORTED_APPLY_PLATFORMS)[number];

export function isSupportedApplyPlatform(value: string): value is SupportedApplyPlatform {
  return SUPPORTED_APPLY_PLATFORMS.includes(value as SupportedApplyPlatform);
}

export function parseSupportedApplyPlatform(value: string): SupportedApplyPlatform | null {
  return isSupportedApplyPlatform(value) ? value : null;
}

export function getSupportedApplyPlatformsDisplay(): string {
  return SUPPORTED_APPLY_PLATFORMS.join(", ");
}
