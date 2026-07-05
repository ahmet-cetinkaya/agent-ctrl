import type { Artifact } from "@/core/domain/shared/types/Artifact";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";
import type { Result } from "@/core/domain/shared/value-objects/Result";
import type { SystemError } from "@/core/domain/shared/errors/SystemError";
import type { Rule } from "@/core/domain/shared/entities/Rule";
import type { Skill } from "@/core/domain/shared/entities/Skill";
import type { Agent } from "@/core/domain/shared/entities/Agent";
import type { CommandArtifact } from "@/infrastructure/features/command/scanners/CommandScanner";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

/**
 * Legacy platform adapter interface for artifact synchronization.
 * @deprecated Use IApplyPlatformAdapter for the selected-platform native sync flow.
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
    transport: "stdio" | "http";
    // Stdio transport fields
    command?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    // HTTP transport fields
    url?: string;
    sourceFile: string;
  }[];
}

export interface WriteConfigOptions {
  cleanExistingArtifacts?: boolean;
}

export type ApplyPlatformScope = "project" | "user";
export type ApplyPlatformStatus = "success" | "unchanged";

/**
 * Target configuration location for selected-platform synchronization.
 */
export interface ApplyConfigTarget {
  readonly configPath: string;
  readonly scope: ApplyPlatformScope;
  readonly surface: string;
  /**
   * Directory that should receive platform-specific settings (settings/<platform>/) files.
   * Optional: when omitted, callers fall back to the parent directory of configPath.
   * Adapters whose settings destination differs from configPath's parent should set this explicitly.
   */
  readonly settingsDirectory?: string;
}

/**
 * Request parameters for selected-platform synchronization.
 */
export interface ApplyIntegrationRequest {
  readonly projectPath: string;
  readonly dryRun?: boolean;
  readonly override?: boolean;
  readonly targetScope?: ApplyPlatformScope;
  readonly userConfigRootPath?: string;
  readonly mergedSnapshot?: {
    readonly rules: Rule[];
    readonly skills: Skill[];
    readonly agents: Agent[];
    readonly commands: CommandArtifact[];
    readonly mcpServers: ApplyMcpServer[];
    readonly warnings: string[];
  };
}

/**
 * Artifact counts for synchronization result.
 */
export interface ArtifactCounts {
  readonly rules?: number;
  readonly commands?: number;
  readonly skills?: number;
  readonly agents?: number;
  readonly mcpServers?: number;
}

/**
 * Result of selected-platform synchronization.
 */
export interface ApplyIntegrationResult {
  readonly platform: SupportedApplyPlatform;
  readonly configPath: string;
  readonly scope: ApplyPlatformScope;
  readonly surface: string;
  readonly status: ApplyPlatformStatus;
  readonly message: string;
  readonly artifactCounts?: ArtifactCounts;
  readonly fileChanges?: readonly string[];
  readonly warnings?: readonly string[];
}

/**
 * Platform adapter contract used by the selected-platform apply flow.
 * Uses Result<T,E> pattern for explicit error handling.
 *
 * Separated from the legacy IPlatformAdapter interface which uses a different
 * approach for artifact synchronization.
 */
export interface IApplyPlatformAdapter {
  readonly platformName: SupportedApplyPlatform;

  /**
   * Resolves the target configuration location for this platform.
   * @param projectPath The root project path
   * @param request Optional integration request parameters
   * @returns The resolved configuration target
   */
  resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget>;

  /**
   * Applies selected-platform synchronization to the target platform.
   * @param request Integration request parameters
   * @returns Result with integration outcome or error
   */
  applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult>;
}
