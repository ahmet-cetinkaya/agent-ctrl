import type { McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

export interface ParsedMcpServerCandidate {
  serverId: string;
  filePath: string;
  config: Record<string, unknown>;
}

export interface ParseMcpServersResult {
  servers: ParsedMcpServerCandidate[];
  issues: McpIssue[];
}

export class McpServersParser {
  private readonly formatter = new McpErrorFormatter();

  parse(filePath: string, document: unknown): ParseMcpServersResult {
    if (!this.isObject(document)) {
      return {
        servers: [],
        issues: [
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_INVALID_JSON_ROOT",
            message: "Top-level MCP config must be a JSON object",
            filePath,
          }),
        ],
      };
    }

    const mcpServers = document.mcpServers;
    if (!this.isObject(mcpServers)) {
      return {
        servers: [],
        issues: [
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_SERVERS_MISSING",
            message: "Missing required top-level 'mcpServers' object",
            filePath,
          }),
        ],
      };
    }

    const servers: ParsedMcpServerCandidate[] = [];
    const issues: McpIssue[] = [];

    for (const [serverId, config] of Object.entries(mcpServers)) {
      if (!this.isObject(config)) {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_SERVER_INVALID",
            message: `Server '${serverId}' must be an object`,
            filePath,
            serverId,
          })
        );
        continue;
      }

      servers.push({
        serverId,
        filePath,
        config,
      });
    }

    return { servers, issues };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
