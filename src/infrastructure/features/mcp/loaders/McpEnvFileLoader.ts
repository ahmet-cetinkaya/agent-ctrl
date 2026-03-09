import { readFile } from "node:fs/promises";

export interface LoadedMcpEnv {
  exists: boolean;
  malformed: boolean;
  variables: Record<string, string>;
  malformedLines: string[];
}

export class McpEnvFileLoader {
  constructor() {}

  async load(envPath: string): Promise<LoadedMcpEnv> {
    try {
      const content = await readFile(envPath, "utf-8");
      const lines = content.split(/\r?\n/);

      const variables: Record<string, string> = {};
      const malformedLines: string[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.length === 0 || line.startsWith("#")) {
          continue;
        }

        const sepIndex = line.indexOf("=");
        if (sepIndex <= 0) {
          malformedLines.push(rawLine);
          continue;
        }

        const key = line.slice(0, sepIndex).trim();
        const rawValue = line.slice(sepIndex + 1).trim();

        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
          malformedLines.push(rawLine);
          continue;
        }

        variables[key] = this.unquote(rawValue);
      }

      return {
        exists: true,
        malformed: malformedLines.length > 0,
        variables,
        malformedLines,
      };
    } catch (error) {
      // Log unexpected errors for debugging while still allowing graceful degradation
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT" && err.code !== "ENOTDIR") {
        console.error(`[MCP] Unexpected error reading .env file at ${envPath}:`, error);
      }
      return {
        exists: false,
        malformed: false,
        variables: {},
        malformedLines: [],
      };
    }
  }

  private unquote(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      return value.slice(1, -1);
    }

    return value;
  }
}
