import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { BaseMcpConfigRenderer } from "./BaseMcpConfigRenderer";

/**
 * Pi platform MCP config renderer.
 *
 * Pi has no native MCP configuration surface, but the most widely adopted community
 * extension (`pi-mcp-adapter`, npm) reads `.mcp.json` in the same `{ mcpServers: {...} }`
 * shape used by Claude Desktop and several other agent-ctrl targets (e.g. ForgeCode).
 * This renderer is only invoked when that extension is detected as installed — see
 * `PiAdapter.isPackageInstalled()`.
 */
export class PiMcpConfigRenderer extends BaseMcpConfigRenderer {
  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown> {
    const stdioServers = this.filterStdioServers(servers);
    const httpServers = this.filterHttpServers(servers);
    const currentMcp = this.isObject(existing.mcpServers) ? existing.mcpServers : {};

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
