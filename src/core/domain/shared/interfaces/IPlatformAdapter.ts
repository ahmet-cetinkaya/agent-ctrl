import type { Artifact } from "@/core/domain/shared/types/Artifact";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { Result } from "@/core/domain/shared/value-objects/Result";
import type { SystemError } from "@/core/domain/shared/errors/SystemError";

/**
 * Legacy platform adapter interface for artifact synchronization.
 * @deprecated Use IAppyPlatformAdapter for new appy integration flow.
 */
export interface IPlatformAdapter {
  readonly platformName: string;
  readonly configPath: string;
  readonly claudeMcpConfigPath?: string;

  /**
   * Generate platform-specific configuration from artifacts
   * @returns Result with PlatformConfig or SystemError if generation fails
   */
  generateConfig(artifacts: Artifact[]): Promise<Result<PlatformConfig, SystemError>>;

  /**
   * Read existing platform configuration
   * @returns Result with PlatformConfig or null if not found, or SystemError if read fails
   */
  readExistingConfig(): Promise<Result<PlatformConfig | null, SystemError>>;

  /**
   * Write configuration to platform's config file
   * @returns Result void or SystemError if write fails
   */
  writeConfig(config: PlatformConfig, options?: WriteConfigOptions): Promise<Result<void, SystemError>>;

  /**
   * Merge new config with existing (preserves non-conflicting entries)
   */
  mergeConfigs(existing: PlatformConfig | null, newConfig: PlatformConfig): PlatformConfig;
}

/**
 * Platform configuration with immutable array properties.
 * Arrays are readonly to prevent accidental mutation after creation.
 */
export interface PlatformConfig {
  readonly rules: readonly { name: string; path: string }[];
  readonly skills: readonly { name: string; path: string }[];
  readonly agents: readonly { name: string; path: string }[];
  readonly mcpServers?: readonly {
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env: Record<string, string>;
    sourceFile: string;
  }[];
}

export interface WriteConfigOptions {
  cleanExistingArtifacts?: boolean;
}

export type ApplyPlatformScope = "project" | "user";
export type ApplyPlatformStatus = "success" | "unchanged";

/**
 * Target configuration location for appy integration.
 */
export interface AppyConfigTarget {
  readonly configPath: string;
  readonly scope: ApplyPlatformScope;
  readonly surface: string;
}

/**
 * Request parameters for appy integration.
 */
export interface AppyIntegrationRequest {
  readonly projectPath: string;
  readonly dryRun?: boolean;
  readonly override?: boolean;
  readonly targetScope?: ApplyPlatformScope;
  readonly userConfigRootPath?: string;
}

/**
 * Result of appy integration operation.
 */
export interface AppyIntegrationResult {
  readonly platform: SupportedApplyPlatform;
  readonly configPath: string;
  readonly scope: ApplyPlatformScope;
  readonly surface: string;
  readonly status: ApplyPlatformStatus;
  readonly message: string;
}

/**
 * Appy-specific adapter contract used by the selected-platform apply flow.
 * Uses Result<T,E> pattern for explicit error handling.
 *
 * Separated from the legacy IPlatformAdapter interface which uses a different
 * approach for artifact synchronization.
 */
export interface IAppyPlatformAdapter {
  readonly platformName: SupportedApplyPlatform;

  /**
   * Resolves the target configuration location for this platform.
   * @param projectPath The root project path
   * @param request Optional integration request parameters
   * @returns The resolved configuration target
   */
  resolveTarget(projectPath: string, request?: AppyIntegrationRequest): Promise<AppyConfigTarget>;

  /**
   * Applies appy integration to the target platform.
   * @param request Integration request parameters
   * @returns Result with integration outcome or error
   */
  applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult>;
}
