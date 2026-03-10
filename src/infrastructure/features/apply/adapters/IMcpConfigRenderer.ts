import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

/**
 * Interface for platform-specific MCP server configuration rendering.
 */
export interface IMcpConfigRenderer {
  /**
   * Render MCP servers configuration for this platform.
   * @param existing The existing configuration object
   * @param servers The MCP servers to render
   * @returns The rendered configuration object
   */
  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown>;

  /**
   * Render MCP servers as a string (for TOML-based platforms).
   * @param servers The MCP servers to render
   * @returns The rendered configuration string
   */
  renderToString?(servers: ApplyMcpServer[]): string;
}
