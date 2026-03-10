import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { BaseMcpConfigRenderer } from "./BaseMcpConfigRenderer";

/**
 * Settings (Claude) platform MCP config renderer.
 * Renders MCP servers as JSON configuration with mcpServers key.
 */
export class SettingsMcpConfigRenderer extends BaseMcpConfigRenderer {
  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown> {
    const stdioServers = this.filterStdioServers(servers);
    const current = this.isObject(existing.mcpServers) ? existing.mcpServers : {};
    return {
      ...existing,
      mcpServers: {
        ...current,
        ...Object.fromEntries(
          stdioServers.map((server) => [
            server.name,
            {
              command: server.command,
              args: server.args,
              ...(server.cwd ? { cwd: server.cwd } : {}),
              ...(server.env && Object.keys(server.env).length > 0 ? { env: server.env } : {}),
            },
          ])
        ),
      },
    };
  }
}
