import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import type { ApplyPlatformScope, ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import {
  getSupportedApplyPlatformsDisplay,
  parseSupportedApplyPlatform,
} from "@/core/domain/shared/types/SupportedApplyPlatform";
import { PlatformAdapterRegistry } from "@/infrastructure/features/apply/adapters/PlatformAdapterRegistry";

export interface ApplyCommandOptions {
  projectPath: string;
  platform: string;
  dryRun?: boolean;
  override?: boolean;
  targetScope?: ApplyPlatformScope;
  userConfigRootPath?: string;
}

export interface ApplyCommandResult {
  platform: string;
  status: ApplyPlatformStatus;
  configPath: string;
  scope: "project" | "user";
  surface: string;
  message: string;
  durationMs: number;
  warnings: string[];
}

export class ApplyCommand {
  private readonly adapterRegistry: PlatformAdapterRegistry;

  constructor(adapterRegistry?: PlatformAdapterRegistry) {
    this.adapterRegistry = adapterRegistry ?? new PlatformAdapterRegistry();
  }

  async execute(options: ApplyCommandOptions): Promise<Result<ApplyCommandResult, Error>> {
    const { projectPath, platform, dryRun, override, targetScope, userConfigRootPath } = options;

    const selectedPlatform = parseSupportedApplyPlatform(platform);
    if (!selectedPlatform) {
      return err(
        new UserError(
          `Platform '${platform}' not supported. Supported platforms: ${getSupportedApplyPlatformsDisplay()}`
        )
      );
    }

    const adapter = this.adapterRegistry.resolve(selectedPlatform);
    const startedAt = Date.now();

    try {
      const applyResult = await adapter.applyAppyIntegration({
        projectPath,
        dryRun,
        override,
        targetScope,
        userConfigRootPath,
      });

      const durationMs = Date.now() - startedAt;
      const warnings: string[] = [];
      if (dryRun) {
        warnings.push("Dry run mode: no file system changes were written.");
      }

      return ok({
        platform: applyResult.platform,
        status: applyResult.status,
        configPath: applyResult.configPath,
        scope: applyResult.scope,
        surface: applyResult.surface,
        message: applyResult.message,
        durationMs,
        warnings,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EACCES") {
        return err(
          new SystemError(`Permission denied: cannot write selected platform config for '${selectedPlatform}'.`)
        );
      }
      return err(
        new SystemError(
          `Failed to apply 'appy' integration for '${selectedPlatform}'. ${String(
            error instanceof Error ? error.message : error
          )}`
        )
      );
    }
  }
}
