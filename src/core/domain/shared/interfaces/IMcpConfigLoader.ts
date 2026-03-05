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
  load(projectPath: string): Promise<Result<McpLoadResult, Error>>;
}
