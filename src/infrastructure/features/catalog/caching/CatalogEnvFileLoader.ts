import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ok, err } from "@/core/domain/shared/value-objects/Result";

export interface CatalogEnvLoadResult {
  path: string;
  values: Record<string, string>;
}

export class CatalogEnvFileLoader {
  async load(configRoot: string) {
    const envPath = resolve(configRoot, ".env");

    try {
      const content = await readFile(envPath, "utf-8");
      const values: Record<string, string> = {};

      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
          continue;
        }

        const separatorIndex = line.indexOf("=");
        if (separatorIndex <= 0) {
          continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (!key) {
          continue;
        }

        values[key] = this.unquote(value);
      }

      return ok<CatalogEnvLoadResult>({
        path: envPath,
        values,
      });
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      if (nodeErr.code === "ENOENT") {
        return ok<CatalogEnvLoadResult>({
          path: envPath,
          values: {},
        });
      }

      return err(new Error(`Failed to load catalog .env file at ${envPath}: ${nodeErr.message}`));
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
