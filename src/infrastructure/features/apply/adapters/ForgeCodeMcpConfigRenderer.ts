import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { BaseMcpConfigRenderer } from "./BaseMcpConfigRenderer";

/**
 * ForgeCode platform MCP config renderer.
 * Renders MCP servers as JSON configuration for .mcp.json file.
 * Format is identical to Claude Desktop's settings.json format.
 */
export class ForgeCodeMcpConfigRenderer extends BaseMcpConfigRenderer {
  constructor() {
    super();
  }

  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown> {
    const stdioServers = this.filterStdioServers(servers);
    const httpServers = this.filterHttpServers(servers);
    const currentMcp = this.isObject(existing.mcpServers) ? existing.mcpServers : {};

    // Merge stdio servers
    const stdioConfig = Object.fromEntries(
      stdioServers.map((server) => [
        server.name,
        {
          command: server.command,
          args: server.args,
          ...(server.cwd ? { cwd: server.cwd } : {}),
          ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
        },
      ])
    );

    // Merge HTTP servers
    const httpConfig = Object.fromEntries(
      httpServers.map((server) => [
        server.name,
        {
          url: server.url,
          ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
        },
      ])
    );

    return {
      ...existing,
      mcpServers: {
        ...currentMcp,
        ...stdioConfig,
        ...httpConfig,
      },
    };
  }
}
