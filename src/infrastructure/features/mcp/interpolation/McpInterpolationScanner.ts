export interface McpInterpolationRef {
  token: string;
  variableName: string;
  jsonPath: string;
}

export class McpInterpolationScanner {
  scan(value: unknown, jsonPath = "$"): McpInterpolationRef[] {
    if (typeof value === "string") {
      return this.scanString(value, jsonPath);
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry, index) => this.scan(entry, `${jsonPath}[${index}]`));
    }

    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      return Object.entries(obj).flatMap(([key, entry]) => this.scan(entry, `${jsonPath}.${key}`));
    }

    return [];
  }

  private scanString(input: string, jsonPath: string): McpInterpolationRef[] {
    const refs: McpInterpolationRef[] = [];
    const regex = /\$\{([^}]+)\}/g;

    for (const match of input.matchAll(regex)) {
      refs.push({
        token: match[0],
        variableName: match[1],
        jsonPath,
      });
    }

    return refs;
  }
}
