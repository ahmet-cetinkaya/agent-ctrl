import type { McpLoadReport, McpLoadedServer } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { Result, err, ok } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

export interface ListMcpServersQueryOptions {
  projectPath: string;
}

export interface ListMcpServersQueryResult {
  servers: McpLoadedServer[];
  report: McpLoadReport;
}

/**
 * Query to list MCP servers in the project.
 * The loader handles expected I/O errors and returns detailed results.
 */
export class ListMcpServersQuery {
  private readonly loader: McpServerAggregator;

  constructor() {
    this.loader = new McpServerAggregator();
  }

  async execute(options: ListMcpServersQueryOptions): Promise<Result<ListMcpServersQueryResult, Error>> {
    const loaded = await this.loader.load(options.projectPath);
    if (!loaded.success) {
      return err(new UserError(`Failed to list MCP servers: ${loaded.error.message}`, ERROR_IDS.MCP_LOAD_FAILED));
    }

    return ok({
      servers: loaded.data.servers,
      report: loaded.data.report,
    });
  }
}
