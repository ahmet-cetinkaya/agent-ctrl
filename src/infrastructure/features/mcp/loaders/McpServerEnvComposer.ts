export class McpServerEnvComposer {
  constructor() {}

  /**
   * Composes the final runtime environment for an MCP server by merging base .env
   * variables with server-specific env overrides.
   *
   * PRECEDENCE (contractual): serverEnv values override baseEnv values on key collision.
   * This is intentional: server configs provide overrides for shared .env values.
   *
   * Only env vars that are referenced in command, args, or explicitly defined in serverEnv
   * are included in the final env (to avoid leaking all env vars to the server).
   *
   * @param baseEnv - Environment variables from MCPs/.env (shared across all servers)
   * @param serverEnv - Server-specific env from mcpServers.<id>.env (optional)
   * @param args - Resolved args (used to determine which env vars are needed)
   * @param command - Resolved command (used to determine which env vars are needed)
   * @returns Filtered environment with only needed variables
   *
   * @example
   * ```ts
   * compose({ API_KEY: "shared", OTHER: "base" }, { API_KEY: "override" }, ["${API_KEY}"], "npx foo")
   * // Returns: { API_KEY: "override" }  // Only API_KEY is needed
   * ```
   */
  compose(
    baseEnv: Record<string, string>,
    serverEnv?: Record<string, string>,
    args?: string[],
    command?: string
  ): Record<string, string> {
    // Determine which env vars are actually needed
    const neededVars = new Set<string>();

    // Check command and args for ${VAR} references
    const checkForRefs = (str: string | undefined) => {
      if (!str) return;
      const matches = str.match(/\$\{([^}]+)\}/g);
      if (matches) {
        matches.forEach((m) => {
          const varName = m.slice(2, -1);
          neededVars.add(varName);
        });
      }
    };

    checkForRefs(command);
    args?.forEach(checkForRefs);

    // Always include server-specific env vars
    if (serverEnv) {
      Object.keys(serverEnv).forEach((k) => neededVars.add(k));
    }

    // Build filtered env with only needed vars
    const result: Record<string, string> = {};

    // Add base env vars that are needed
    for (const key of neededVars) {
      if (key in baseEnv) {
        result[key] = baseEnv[key];
      }
    }

    // Server env overrides base env
    if (serverEnv) {
      for (const key of Object.keys(serverEnv)) {
        result[key] = serverEnv[key];
      }
    }

    return result;
  }
}
