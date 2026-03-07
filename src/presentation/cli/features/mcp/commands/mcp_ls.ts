import { Command } from "commander";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListMcpServersQuery } from "@/core/application/features/mcp/queries/ListMcpServersQuery";
import {
  handleDirectoryAccess,
  handleQueryResult,
  validateUserPath,
} from "@/presentation/cli/shared/handlers/resultHandler";

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
        console.log(
          JSON.stringify(
            {
              configRoot: configRootPath,
              mcpDir,
              servers,
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
