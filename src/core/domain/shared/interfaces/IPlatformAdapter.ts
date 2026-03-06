import type { Artifact } from "@/core/domain/shared/types/Artifact";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform";

export interface IPlatformAdapter {
  readonly platformName: string;
  readonly configPath: string;
  readonly claudeMcpConfigPath?: string;

  /**
   * Generate platform-specific configuration from artifacts
   */
  generateConfig(artifacts: Artifact[]): Promise<PlatformConfig>;

  /**
   * Read existing platform configuration
   */
  readExistingConfig(): Promise<PlatformConfig | null>;

  /**
   * Write configuration to platform's config file
   */
  writeConfig(config: PlatformConfig, options?: WriteConfigOptions): Promise<void>;

  /**
   * Merge new config with existing (preserves non-conflicting entries)
   */
  mergeConfigs(existing: PlatformConfig | null, newConfig: PlatformConfig): PlatformConfig;
}

export interface PlatformConfig {
  rules: Array<{ name: string; path: string }>;
  skills: Array<{ name: string; path: string }>;
  agents: Array<{ name: string; path: string }>;
  mcpServers?: Array<{
    name: string;
    command: string;
    args: string[];
    cwd?: string;
    env: Record<string, string>;
    sourceFile: string;
  }>;
}

export interface WriteConfigOptions {
  cleanExistingArtifacts?: boolean;
}

export type ApplyPlatformScope = "project" | "user";
export type ApplyPlatformStatus = "success" | "unchanged";

export interface AppyConfigTarget {
  configPath: string;
  scope: ApplyPlatformScope;
  surface: string;
}

export interface AppyIntegrationRequest {
  projectPath: string;
  dryRun?: boolean;
  override?: boolean;
}

export interface AppyIntegrationResult {
  platform: SupportedApplyPlatform;
  configPath: string;
  scope: ApplyPlatformScope;
  surface: string;
  status: ApplyPlatformStatus;
  message: string;
}

/**
 * Appy-specific adapter contract used by the selected-platform apply flow.
 * Kept separate from the legacy artifact-sync interface above.
 */
export interface IAppyPlatformAdapter {
  readonly platformName: SupportedApplyPlatform;

  resolveTarget(projectPath: string): Promise<AppyConfigTarget>;

  applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult>;
}
