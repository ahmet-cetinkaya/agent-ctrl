import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";
import type { IMcpConfigRenderer } from "./IMcpConfigRenderer";

/**
 * Base MCP config renderer with shared utilities.
 */
export abstract class BaseMcpConfigRenderer implements IMcpConfigRenderer {
  abstract renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown>;

  /**
   * Filter and return only stdio-based servers.
   * Most platforms only support stdio transport.
   */
  protected filterStdioServers(servers: ApplyMcpServer[]): ApplyMcpServer[] {
    return servers.filter((s): s is ApplyMcpServer & { transport: "stdio" } => s.transport === "stdio");
  }

  /**
   * Filter and return only HTTP-based servers.
   * Some platforms support HTTP transport for MCP servers.
   */
  protected filterHttpServers(servers: ApplyMcpServer[]): ApplyMcpServer[] {
    return servers.filter((s): s is ApplyMcpServer & { transport: "http" } => s.transport === "http");
  }

  /**
   * Check if a value is a plain object.
   */
  protected isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
