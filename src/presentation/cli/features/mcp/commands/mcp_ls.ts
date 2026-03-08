import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListMcpServersQuery } from "@/core/application/features/mcp/queries/ListMcpServersQuery";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

/**
 * Redacts sensitive values from environment variables for safe JSON output.
 * Masks API keys, tokens, passwords, and other sensitive credentials.
 */
function redactEnvVars(env: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  const sensitiveKeys = [
    "key",
    "token",
    "secret",
    "password",
    "apikey",
    "api_key",
    "auth",
    "credential",
    "private",
    "certificate",
  ];

  for (const [key, value] of Object.entries(env)) {
    const keyLower = key.toLowerCase();
    const isSensitive = sensitiveKeys.some((sensitive) => keyLower.includes(sensitive));
    redacted[key] = isSensitive ? "***REDACTED***" : value;
  }

  return redacted;
}

/**
 * Creates the 'mcp ls' CLI subcommand for listing all MCP servers in the project.
 *
 * The mcp ls subcommand lists all MCP server configurations found in the mcps/ directory.
 * Displays server IDs and reports any issues with server configurations.
 * Supports both project-scoped and global user configuration.
 *
 * @returns {Command} Configured Commander Command instance
 *
 * @example
 * ```bash
 * # List MCP servers in default location
 * agent-ctrl mcp ls
 *
 * # List MCP servers in JSON format with full details
 * agent-ctrl mcp ls --json
 *
 * # List MCP servers from custom config root
 * agent-ctrl mcp ls /custom/path
 * ```
 */
export function createMcpListCommand(): Command {
  return new Command("ls")
    .description("List all MCP servers in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      // Validate user-provided path
      if (targetPath) {
        const pathError = validateUserPath(targetPath, "--path");
        if (pathError) {
          console.error(`✗ ${pathError}`);
          process.exit(1);
        }
      }

      const configRootPath = targetPath
        ? resolve(targetPath)
        : resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
      const mcpDir = resolve(configRootPath, "mcps");

      // Check directory access with specific error handling
      const accessResult = await handleDirectoryAccess(mcpDir, "mcps/");
      if (!accessResult.success) {
        console.error(`✗ ${accessResult.error}`);
        process.exit(1);
      }

      const listMcpServersQuery = new ListMcpServersQuery();
      const result = await listMcpServersQuery.execute({ projectPath: configRootPath });

      handleQueryResult(result);

      const { servers, report } = result.data;
      const issues = report.fileResults.flatMap((entry) => entry.issues);

      if (options.json) {
        // Redact sensitive environment variables for security
        const safeServers = servers.map((server) => ({
          ...server,
          env: redactEnvVars(server.env),
        }));

        console.log(
          JSON.stringify(
            {
              configRoot: configRootPath,
              mcpDir,
              servers: safeServers,
              report,
            },
            null,
            2
          )
        );
        return;
      }

      if (servers.length === 0) {
        console.log(`No MCP servers found in ${mcpDir}`);
      } else {
        console.log(`MCP servers (${servers.length}):`);
        for (const server of servers) {
          console.log(`  ${server.serverId}`);
        }
      }

      if (issues.length > 0) {
        console.log("\nIssues:");
        for (const issue of issues) {
          const scope = issue.serverId ? `${issue.serverId}: ` : "";
          console.log(`  - [${issue.severity}] ${scope}${issue.message}`);
        }
      }
    });
}
