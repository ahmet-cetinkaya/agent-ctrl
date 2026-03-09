import { Command } from "commander";
import { AddMcpCommand } from "@/core/application/features/mcp/commands/AddMcpCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createMcpAddCommand(): Command {
  return new Command("add")
    .description("Activate an MCP from the synchronized catalog")
    .argument("<ref>", "MCP reference such as smithery:namespace/server")
    .option("-j, --json", "Output as JSON")
    .option("--refresh", "Refresh source data before activation")
    .option("--version <value>", "Request a specific version when supported")
    .option("--api-key <value>", "Override the Smithery API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      const command = new AddMcpCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        refresh: Boolean(options.refresh),
        version: options.version as string | undefined,
        apiKey: options.apiKey as string | undefined,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        console.log(JSON.stringify(result.data, null, 2));
        return;
      }
      console.log(`Activated MCP ${result.data.item.displayName} at ${result.data.managedIntegration.localPath}`);
    });
}
