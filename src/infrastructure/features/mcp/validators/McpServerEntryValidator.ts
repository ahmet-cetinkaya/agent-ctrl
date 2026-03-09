import type { McpIssue, McpTransportType } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

export interface ValidatedMcpServer {
  serverId: string;
  filePath: string;
  transport: McpTransportType;
  // Stdio transport fields
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  // HTTP transport fields
  url?: string;
  rawConfig: Record<string, unknown>;
}

export class McpServerEntryValidator {
  private readonly formatter = new McpErrorFormatter();

  constructor() {}

  validate(
    serverId: string,
    filePath: string,
    rawConfig: Record<string, unknown>
  ): {
    validated?: ValidatedMcpServer;
    issues: McpIssue[];
  } {
    const issues: McpIssue[] = [];

    // Detect transport type
    const type = rawConfig.type as string | undefined;
    const transport: McpTransportType = type === "http" ? "http" : "stdio";

    if (transport === "stdio") {
      // Validate stdio transport
      const command = rawConfig.command;
      if (typeof command !== "string" || command.trim().length === 0) {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_COMMAND_INVALID",
            message: `Server '${serverId}' must define non-empty 'command'`,
            filePath,
            serverId,
          })
        );
      }

      const args = rawConfig.args;
      if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_ARGS_INVALID",
            message: `Server '${serverId}' must define 'args' as string array`,
            filePath,
            serverId,
          })
        );
      }

      const cwd = rawConfig.cwd;
      if (cwd !== undefined && typeof cwd !== "string") {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_CWD_INVALID",
            message: `Server '${serverId}' has invalid 'cwd' value`,
            filePath,
            serverId,
          })
        );
      }

      const env = rawConfig.env;
      if (env !== undefined) {
        if (!this.isObject(env)) {
          issues.push(
            this.formatter.createIssue({
              severity: "error",
              code: "MCP_ENV_INVALID",
              message: `Server '${serverId}' must define 'env' as object<string,string>`,
              filePath,
              serverId,
            })
          );
        } else {
          for (const [key, value] of Object.entries(env)) {
            if (typeof value !== "string") {
              issues.push(
                this.formatter.createIssue({
                  severity: "error",
                  code: "MCP_ENV_VALUE_INVALID",
                  message: `Server '${serverId}' env '${key}' must be a string`,
                  filePath,
                  serverId,
                })
              );
            }
          }
        }
      }

      if (issues.length > 0) {
        return { issues };
      }

      return {
        validated: {
          serverId,
          filePath,
          transport: "stdio",
          command: command as string,
          args: args as string[],
          cwd: cwd as string | undefined,
          env: env as Record<string, string> | undefined,
          rawConfig,
        },
        issues,
      };
    } else {
      // Validate HTTP transport
      const url = rawConfig.url;
      if (typeof url !== "string" || url.trim().length === 0) {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "MCP_URL_INVALID",
            message: `Server '${serverId}' must define non-empty 'url' for HTTP transport`,
            filePath,
            serverId,
          })
        );
      }

      if (issues.length > 0) {
        return { issues };
      }

      return {
        validated: {
          serverId,
          filePath,
          transport: "http",
          url: url as string,
          rawConfig,
        },
        issues,
      };
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
