export class McpPlaceholderResolver {
  /**
   * Resolves ${VAR} placeholders in arbitrary data structures using provided variables.
   *
   * CONTRACT: This is a BEST-EFFORT resolver. It does NOT validate that all placeholders
   * are resolved - validation happens separately in McpPlaceholderValidation. Unresolved
   * placeholders are left as literal strings (e.g., "${MISSING}" stays "${MISSING}").
   *
   * This design allows the resolver to be pure and side-effect-free while a separate
   * validation layer collects actionable errors.
   *
   * @param value - Any JSON-serializable value potentially containing ${VAR} placeholders
   * @param variables - Map of variable names to resolved values
   * @returns Value with all known placeholders replaced; unknown placeholders unchanged
   *
   * @example
   * ```ts
   * resolve({ x: "${A}", y: "${B}" }, { A: "1" })
   * // Returns: { x: "1", y: "${B}" }  // Note: ${B} is preserved, not replaced
   * ```
   */
  resolve(value: unknown, variables: Record<string, string>): unknown {
    if (typeof value === "string") {
      return value.replace(/\$\{([^}]+)\}/g, (_match, variableName: string) => {
        return variableName in variables ? variables[variableName] : `\${${variableName}}`;
      });
    }

    if (Array.isArray(value)) {
      return value.map((entry) => this.resolve(entry, variables));
    }

    if (typeof value === "object" && value !== null) {
      // Use Object.create(null) to prevent prototype pollution attacks
      const result: Record<string, unknown> = Object.create(null);
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        // Skip dangerous prototype keys to prevent pollution
        if (key === "__proto__" || key === "constructor") {
          continue;
        }
        result[key] = this.resolve(entry, variables);
      }
      return result;
    }

    return value;
  }
}
