import { Command } from "commander";
import { AddMcpCommand } from "@/core/application/features/mcp/commands/AddMcpCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
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
    .option("-d, --dry-run", "Preview what would be activated without activating", false)
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      if (options.dryRun) {
        LogService.intro("Activating MCP");
        LogService.log(`Would activate MCP: ${ref}`);
        LogService.log("Note: Use without --dry-run to activate");
        return;
      }

      LogService.intro("Activating MCP");
      PromptService.startTask(`Activating MCP ${ref}`);
      const command = new AddMcpCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        refresh: Boolean(options.refresh),
        version: options.version as string | undefined,
        apiKey: options.apiKey as string | undefined,
      });

      if (!result.success) {
        PromptService.stopTask();
        handleQueryResult(result);
        return;
      }
      PromptService.stopTask("MCP activated");

      if (options.json) {
        LogService.raw(JSON.stringify(result.data, null, 2));
        return;
      }

      LogService.success(
        `MCP ${result.data.item.displayName} activated at ${result.data.managedIntegration.localPath}`
      );
      LogService.outro(`Activated ${result.data.item.displayName}`);
    });
}
