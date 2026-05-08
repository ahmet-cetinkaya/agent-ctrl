import type { IAppyPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { ClaudeApplyAdapter } from "@/infrastructure/features/claude/adapters/ClaudeApplyAdapter";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { AntigravityAdapter } from "@/infrastructure/features/antigravity/adapters/AntigravityAdapter";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";
import { WindsurfAdapter } from "@/infrastructure/features/windsurf/adapters/WindsurfAdapter";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";

/**
 * Registry for platform adapters with validation.
 * Ensures all supported platforms have registered adapters.
 */
export class PlatformAdapterRegistry {
  private readonly registry = new Map<SupportedApplyPlatform, IApplyPlatformAdapter>();
  private readonly factories: Record<SupportedApplyPlatform, () => IApplyPlatformAdapter> = {
    antigravity: () => new AntigravityAdapter(),
    claude: () => new ClaudeApplyAdapter(),
    codex: () => new CodexAdapter(),
    cursor: () => new CursorAdapter(),
    gemini: () => new GeminiAdapter(),
    kilo: () => new KiloAdapter(),
    opencode: () => new OpenCodeAdapter(),
    qwen: () => new QwenAdapter(),
    windsurf: () => new WindsurfAdapter(),
  };

  constructor() {
    const registeredPlatforms = new Set(Object.keys(this.factories) as SupportedApplyPlatform[]);
    const missing = SUPPORTED_APPLY_PLATFORMS.filter((platform) => !registeredPlatforms.has(platform));
    if (missing.length > 0) {
      throw new SystemError(
        `Missing adapters for platforms: ${missing.join(", ")}. This is a programming error.`,
        ERROR_IDS.ADAPTER_NOT_REGISTERED
      );
    }
  }

  /**
   * Resolves the adapter for the given platform.
   * @throws {SystemError} If the adapter is not registered (should never happen with validation)
   */
  resolve(platform: SupportedApplyPlatform): IApplyPlatformAdapter {
    const existing = this.registry.get(platform);
    if (existing) {
      return existing;
    }

    const factory = this.factories[platform];
    if (!factory) {
      throw new SystemError(
        `Adapter is not registered for platform '${platform}'. This is a programming error - platform validation should have occurred before calling resolve().`,
        ERROR_IDS.ADAPTER_RESOLUTION_FAILED
      );
    }

    const adapter = factory();
    this.registry.set(platform, adapter);
    return adapter;
  }

  /**
   * Checks if a platform has a registered adapter.
   */
  has(platform: SupportedApplyPlatform): boolean {
    return platform in this.factories;
  }

  listSupportedPlatforms(): SupportedApplyPlatform[] {
    return [...SUPPORTED_APPLY_PLATFORMS];
  }
}
