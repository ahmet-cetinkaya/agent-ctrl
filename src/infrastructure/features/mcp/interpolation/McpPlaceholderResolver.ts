export class McpPlaceholderResolver {
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
      const result: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.resolve(entry, variables);
      }
      return result;
    }

    return value;
  }
}
