import { Command } from "commander";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { ListMcpServersQuery } from "@/core/application/features/mcp/queries/ListMcpServersQuery";
import { UserError } from "@/core/domain/shared/errors/UserError";

export function createMcpListCommand(): Command {
  return new Command("ls")
    .description("List all MCP servers in the project")
    .argument("[path]", "Configuration root path (default: ~/.agent-ctrl)")
    .option("-j, --json", "Output as JSON")
    .action(async (targetPath: string | undefined, options: { json?: boolean }) => {
      const configRootPath = targetPath
        ? resolve(targetPath)
        : resolve(process.env.AGENT_CTRL_HOME ?? homedir(), ".agent-ctrl");
      const mcpDir = resolve(configRootPath, "mcps");

      try {
        await access(mcpDir, constants.R_OK);
      } catch {
        console.error(`✗ mcps/ directory not found at ${mcpDir}. Run 'agent-ctrl init' first.`);
        process.exit(1);
      }

      const listMcpServersQuery = new ListMcpServersQuery();
      const result = await listMcpServersQuery.execute({ projectPath: configRootPath });

      if (!result.success) {
        if (result.error instanceof UserError) {
          console.error(`✗ ${result.error.message}`);
          process.exit(result.error.exitCode);
        }
        console.error(`✗ Unexpected error: ${result.error}`);
        process.exit(2);
      }

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
