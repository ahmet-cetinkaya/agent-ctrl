import { Command } from "commander";
import { UpdateMcpCommand } from "@/core/application/features/mcp/commands/UpdateMcpCommand";
import { handleQueryResult } from "@/presentation/cli/shared/handlers/resultHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";
import { renderLifecycleSummary } from "@/presentation/cli/shared/utils/catalogOutput";
import { resolveConfigRoot } from "@/presentation/cli/shared/utils/configRoot";

export function createMcpUpdateCommand(): Command {
  return new Command("update")
    .description("Update one or more managed MCPs")
    .argument("[ref]", "Managed MCP identifier")
    .option("--all", "Update all managed MCPs")
    .option("--refresh", "Refresh source data before updating")
    .option("-j, --json", "Output as JSON")
    .option("--api-key <value>", "Override the Smithery API key for this command")
    .option("--path <value>", "Configuration root path")
    .action(async (ref: string | undefined, options: Record<string, string | boolean | undefined>) => {
      LogService.intro("Updating MCPs");
      const command = new UpdateMcpCommand();
      const result = await command.execute({
        configRoot: resolveConfigRoot(options.path as string | undefined),
        ref,
        all: Boolean(options.all),
        refresh: Boolean(options.refresh),
        apiKey: options.apiKey as string | undefined,
      });

      handleQueryResult(result);
      if (!result.success) {
        return;
      }
      if (options.json) {
        LogService.unstyled(JSON.stringify(result.data, null, 2));
      } else {
        for (const line of renderLifecycleSummary(result.data)) {
          LogService.log(line);
        }
      }
      LogService.outro("Update complete");
    });
}
