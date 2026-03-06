export class McpServerEnvComposer {
  constructor() {}

  /**
   * Composes the final runtime environment for an MCP server by merging base .env
   * variables with server-specific env overrides.
   *
   * PRECEDENCE (contractual): serverEnv values override baseEnv values on key collision.
   * This is intentional: server configs provide overrides for shared .env values.
   *
   * @param baseEnv - Environment variables from MCPs/.env (shared across all servers)
   * @param serverEnv - Server-specific env from mcpServers.<id>.env (optional)
   * @returns Merged environment where serverEnv takes precedence over baseEnv
   *
   * @example
   * ```ts
   * compose({ API_KEY: "shared", OTHER: "base" }, { API_KEY: "override" })
   * // Returns: { API_KEY: "override", OTHER: "base" }
   * ```
   */
  compose(baseEnv: Record<string, string>, serverEnv?: Record<string, string>): Record<string, string> {
    return {
      ...baseEnv,
      ...(serverEnv ?? {}),
    };
  }
}
