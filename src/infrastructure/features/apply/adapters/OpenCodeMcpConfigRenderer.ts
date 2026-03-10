import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { BaseMcpConfigRenderer } from "./BaseMcpConfigRenderer";

/**
 * OpenCode platform MCP config renderer.
 * Renders MCP servers as JSON configuration.
 */
export class OpenCodeMcpConfigRenderer extends BaseMcpConfigRenderer {
  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown> {
    const stdioServers = this.filterStdioServers(servers);
    const currentMcp = this.isObject(existing.mcp) ? existing.mcp : {};
    const nextMcp = {
      ...currentMcp,
      ...Object.fromEntries(
        stdioServers.map((server) => [
          server.name,
          {
            type: "local",
            command: [server.command!, ...server.args!],
            enabled: true,
            ...(server.cwd ? { cwd: server.cwd } : {}),
            ...(server.env && Object.keys(server.env).length > 0 ? { environment: server.env } : {}),
          },
        ])
      ),
    };

    return {
      ...existing,
      $schema: typeof existing.$schema === "string" ? existing.$schema : "https://opencode.ai/config.json",
      mcp: nextMcp,
    };
  }
}
