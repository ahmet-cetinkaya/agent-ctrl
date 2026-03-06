import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export class McpFileDiscovery {
  constructor() {}

  async discover(mcpDir: string): Promise<string[]> {
    try {
      const entries = await readdir(mcpDir, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => resolve(mcpDir, entry.name))
        .sort((a, b) => a.localeCompare(b));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // Directory doesn't exist - this is expected and fine
      if (err.code === "ENOENT" || err.code === "ENOTDIR") {
        return [];
      }
      // Log unexpected errors for debugging
      console.error(`[MCP] Unexpected error discovering MCP files in ${mcpDir}:`, error);
      // Still return empty to allow graceful degradation
      return [];
    }
  }
}
