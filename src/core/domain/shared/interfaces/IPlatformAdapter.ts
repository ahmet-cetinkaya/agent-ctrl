import type { Artifact } from "@/core/domain/shared/types/Artifact";

export interface IPlatformAdapter {
  readonly platformName: string;
  readonly configPath: string;

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
