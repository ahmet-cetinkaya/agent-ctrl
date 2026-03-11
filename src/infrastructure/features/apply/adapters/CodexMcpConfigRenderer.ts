import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import { BaseMcpConfigRenderer } from "./BaseMcpConfigRenderer";

/**
 * Codex platform MCP config renderer.
 * Renders MCP servers as TOML configuration.
 */
export class CodexMcpConfigRenderer extends BaseMcpConfigRenderer {
  renderConfig(_existing: Record<string, unknown>, _servers: ApplyMcpServer[]): Record<string, unknown> {
    throw new Error("Codex uses renderToString() instead of renderConfig()");
  }

  renderToString(servers: ApplyMcpServer[]): string {
    const stdioServers = this.filterStdioServers(servers);
    return stdioServers
      .map((server) => {
        const lines = [`[mcp_servers.${server.name}]`, `command = ${this.toTomlString(server.command!)}`];
        if (server.args && server.args.length > 0) {
          lines.push(`args = ${this.toTomlArray(server.args)}`);
        }
        if (server.cwd) {
          lines.push(`cwd = ${this.toTomlString(server.cwd)}`);
        }
        if (server.env && Object.keys(server.env).length > 0) {
          lines.push(`env = ${this.toTomlInlineTable(server.env)}`);
        }
        return lines.join("\n");
      })
      .join("\n\n");
  }

  private toTomlString(value: string): string {
    return JSON.stringify(value);
  }

  private toTomlArray(values: string[]): string {
    return `[${values.map((value) => this.toTomlString(value)).join(", ")}]`;
  }

  private toTomlInlineTable(values: Record<string, string>): string {
    return `{ ${Object.entries(values)
      .map(([key, value]) => `${key} = ${this.toTomlString(value)}`)
      .join(", ")} }`;
  }
}
