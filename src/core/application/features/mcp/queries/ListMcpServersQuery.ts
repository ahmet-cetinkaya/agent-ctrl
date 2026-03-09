import type { McpLoadReport, McpLoadedServer } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import type { CatalogItem, ManagedIntegration } from "@/core/domain/shared/entities";
import { Result, err, ok } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";
import { CatalogStateFileStore } from "@/infrastructure/features/catalog/caching/CatalogStateFileStore";

export interface ListMcpServersQueryOptions {
  projectPath: string;
}

export interface ListMcpServersQueryResult {
  servers: McpLoadedServer[];
  report: McpLoadReport;
  catalogState: {
    managedById: Map<string, ManagedIntegration>;
    catalogById: Map<string, CatalogItem>;
  };
}

/**
 * Query to list MCP servers and load catalog integration state.
 * The loader handles expected I/O errors and returns detailed results including
 * catalog state for managed/server ID mapping and compatibility information.
 */
export class ListMcpServersQuery {
  private readonly loader: McpServerAggregator;
  private readonly catalogStore: CatalogStateFileStore;

  constructor() {
    this.loader = new McpServerAggregator();
    this.catalogStore = new CatalogStateFileStore();
  }

  async execute(options: ListMcpServersQueryOptions): Promise<Result<ListMcpServersQueryResult, Error>> {
    const loaded = await this.loader.load(options.projectPath);
    if (!loaded.success) {
      return err(new UserError(`Failed to list MCP servers: ${loaded.error.message}`, ERROR_IDS.MCP_LOAD_FAILED));
    }

    const catalogState = await this.catalogStore.load(options.projectPath);
    if (!catalogState.success) {
      console.warn(`Warning: Failed to load catalog state: ${catalogState.error.message}`);
      console.warn("Server listing will continue without catalog integration information.");
    }

    // Transform catalog state into Maps for O(1) lookup by server ID.
    // Failed catalog loads result in empty Maps.
    const managedById = new Map(
      catalogState.success
        ? catalogState.data.managedIntegrations
            .filter((entry) => entry.itemType === "mcp")
            .map((entry) => [entry.managedId, entry])
        : []
    );
    const catalogById = new Map(
      catalogState.success
        ? catalogState.data.catalogItems
            .filter((entry) => entry.itemType === "mcp")
            .map((entry) => [entry.sourceItemId, entry])
        : []
    );

    return ok({
      servers: loaded.data.servers,
      report: loaded.data.report,
      catalogState: {
        managedById,
        catalogById,
      },
    });
  }
}
