import type { McpLoadReport, McpLoadedServer } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { Result, err, ok } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

export interface ListMcpServersQueryOptions {
  projectPath: string;
}

export interface ListMcpServersQueryResult {
  servers: McpLoadedServer[];
  report: McpLoadReport;
}

export class ListMcpServersQuery {
  private readonly loader: McpServerAggregator;

  constructor() {
    this.loader = new McpServerAggregator();
  }

  async execute(options: ListMcpServersQueryOptions): Promise<Result<ListMcpServersQueryResult, Error>> {
    try {
      const loaded = await this.loader.load(options.projectPath);
      if (!loaded.success) {
        return err(new UserError(`Failed to list MCP servers: ${loaded.error.message}`));
      }

      return ok({
        servers: loaded.data.servers,
        report: loaded.data.report,
      });
    } catch (error) {
      return err(new UserError(`Failed to list MCP servers: ${error}`));
    }
  }
}
