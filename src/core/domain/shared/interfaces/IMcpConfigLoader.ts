import type { Result } from "@/core/domain/shared/value-objects/Result";

export type McpIssueSeverity = "warning" | "error";
export type McpFileStatus = "loaded" | "skipped" | "failed";

export interface McpIssue {
  severity: McpIssueSeverity;
  code: string;
  message: string;
  filePath: string;
  serverId?: string;
}

export interface McpLoadedServer {
  serverId: string;
  filePath: string;
  command: string;
  args: string[];
  cwd?: string;
  env: Record<string, string>;
}

export interface McpFileResult {
  filePath: string;
  status: McpFileStatus;
  loadedServerCount: number;
  failedServerCount: number;
  issues: McpIssue[];
}

export interface McpLoadReport {
  startedAt: string;
  finishedAt: string;
  totalDiscovered: number;
  totalLoaded: number;
  totalSkipped: number;
  totalFailed: number;
  fileResults: McpFileResult[];
}

export interface McpLoadResult {
  servers: McpLoadedServer[];
  report: McpLoadReport;
}

export interface IMcpConfigLoader {
  /**
   * Loads and validates all MCP server configurations from the project's MCPs directory.
   *
   * @param projectPath - Absolute path to the project root. MCP configs are searched for
   *                      in `<config-root>/mcps/` where config-root is determined by
   *                      AGENT_CTRL_CONFIG_DIR env var or `.agent-ctrl` directory.
   * @returns Result containing loaded servers and detailed report, or error if loading
   *          itself fails (vs. individual file failures which are reported in the report).
   *
   * @example
   * ```ts
   * const result = await loader.load("/my/project");
   * if (result.success) {
   *   console.log(`Loaded ${result.data.report.totalLoaded} servers`);
   * } else {
   *   console.error(`Failed to load: ${result.error.message}`);
   * }
   * ```
   */
  load(projectPath: string): Promise<Result<McpLoadResult, Error>>;
}
