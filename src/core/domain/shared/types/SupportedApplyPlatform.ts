export const SUPPORTED_APPLY_PLATFORMS = [
  "antigravity",
  "claude",
  "codex",
  "cursor",
  "forgecode",
  "gemini",
  "kilo",
  "opencode",
  "qwen",
  "windsurf",
] as const;

export const PLATFORM_DISPLAY_NAMES: Record<SupportedApplyPlatform, string> = {
  antigravity: "Antigravity",
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
  forgecode: "Forge Code",
  gemini: "Gemini Query",
  kilo: "Kilo Code",
  opencode: "OpenCode",
  qwen: "Qwen",
  windsurf: "Windsurf",
};

export type SupportedApplyPlatform = (typeof SUPPORTED_APPLY_PLATFORMS)[number];

export function getPlatformDisplayName(platform: string): string {
  if (isSupportedApplyPlatform(platform)) {
    return PLATFORM_DISPLAY_NAMES[platform];
  }
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

export function isSupportedApplyPlatform(value: string): value is SupportedApplyPlatform {
  return SUPPORTED_APPLY_PLATFORMS.includes(value as SupportedApplyPlatform);
}

export function parseSupportedApplyPlatform(value: string): SupportedApplyPlatform | null {
  return isSupportedApplyPlatform(value) ? value : null;
}

export function getSupportedApplyPlatformsDisplay(): string {
  return SUPPORTED_APPLY_PLATFORMS.join(", ");
}
