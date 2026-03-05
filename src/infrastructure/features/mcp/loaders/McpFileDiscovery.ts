import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

export class McpFileDiscovery {
  async discover(mcpDir: string): Promise<string[]> {
    try {
      const entries = await readdir(mcpDir, { withFileTypes: true });

      return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
        .map((entry) => resolve(mcpDir, entry.name))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  }
}
