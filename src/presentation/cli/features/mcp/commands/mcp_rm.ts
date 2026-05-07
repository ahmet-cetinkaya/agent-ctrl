import { Command } from "commander";
import { RemoveMcpCommand } from "@/core/application/features/mcp/commands/RemoveMcpCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createMcpRemoveCommand(): Command {
  return new Command("rm")
    .description("Deactivate a managed MCP")
    .argument("<ref>", "Managed MCP identifier")
    .option("-j, --json", "Output as JSON")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string, options: Record<string, string | boolean | undefined>) => {
      LogService.intro("Deactivating MCP");
      const command = new RemoveMcpCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        LogService.unstyled(JSON.stringify(result.data, null, 2));
      } else {
        LogService.success(`Deactivated MCP ${result.data.managedIntegration.managedId}`);
      }
    });
}
