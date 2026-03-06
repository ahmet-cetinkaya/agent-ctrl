import type { IAppyPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { AntigravityAdapter } from "@/infrastructure/features/antigravity/adapters/AntigravityAdapter";
import { CodexAdapter } from "@/infrastructure/features/codex/adapters/CodexAdapter";
import { CursorAdapter } from "@/infrastructure/features/cursor/adapters/CursorAdapter";
import { WindsurfAdapter } from "@/infrastructure/features/windsurf/adapters/WindsurfAdapter";

export class PlatformAdapterRegistry {
  private readonly registry: Map<SupportedApplyPlatform, IAppyPlatformAdapter>;

  constructor() {
    const adapters: IAppyPlatformAdapter[] = [
      new OpenCodeAdapter(),
      new GeminiAdapter(),
      new QwenAdapter(),
      new KiloAdapter(),
      new AntigravityAdapter(),
      new CodexAdapter(),
      new CursorAdapter(),
      new WindsurfAdapter(),
    ];

    this.registry = new Map(adapters.map((adapter) => [adapter.platformName, adapter]));
  }

  resolve(platform: SupportedApplyPlatform): IAppyPlatformAdapter {
    const adapter = this.registry.get(platform);
    if (!adapter) {
      throw new Error(`Adapter is not registered for platform '${platform}'`);
    }
    return adapter;
  }

  listSupportedPlatforms(): SupportedApplyPlatform[] {
    return Array.from(this.registry.keys());
  }
}
