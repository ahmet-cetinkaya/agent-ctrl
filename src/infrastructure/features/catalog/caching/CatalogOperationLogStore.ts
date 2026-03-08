import { mkdir, appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ok, err } from "@/core/domain/shared/value-objects/Result";
import type { OperationLogEntry } from "@/core/domain/shared/entities";
import { CatalogPathResolver } from "./CatalogPathResolver";

export class CatalogOperationLogStore {
  private readonly pathResolver = new CatalogPathResolver();

  async append(configRoot: string, entry: OperationLogEntry) {
    const { logFile } = this.pathResolver.resolveFromConfigRoot(configRoot);
    try {
      await mkdir(dirname(logFile), { recursive: true });
      await appendFile(logFile, `${JSON.stringify(entry)}\n`, "utf-8");
      return ok(undefined);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      return err(new Error(`Failed to append catalog operation log: ${nodeErr.message}`));
    }
  }
}
