import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CatalogItem } from "@/core/domain/shared/entities";

export class ManagedMcpMaterializer {
  async install(configRoot: string, item: CatalogItem): Promise<{ localPath: string }> {
    const filePath = resolve(configRoot, "mcps", `${this.sanitize(item.sourceItemId)}.json`);
    await mkdir(resolve(filePath, ".."), { recursive: true });

    const serverId = item.sourceItemId;
    const command = this.resolveCommand(item);
    const args = this.resolveArgs(item);
    const payload = {
      mcpServers: {
        [serverId]: {
          command,
          args,
          ...(item.metadata?.cwd ? { cwd: item.metadata.cwd } : {}),
          ...(item.metadata?.env ? { env: item.metadata.env } : {}),
        },
      },
    };

    await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
    return { localPath: filePath };
  }

  async remove(localPath: string): Promise<void> {
    await rm(localPath, { force: true });
  }

  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
  }

  private resolveCommand(item: CatalogItem): string {
    const configured = item.metadata?.command;
    if (typeof configured === "string" && configured.trim().length > 0) {
      return configured.trim();
    }
    return "npx";
  }

  private resolveArgs(item: CatalogItem): string[] {
    const configured = item.metadata?.args;
    if (Array.isArray(configured)) {
      const args = configured.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
      if (args.length > 0) {
        return args;
      }
    }

    const deploymentUrl = item.metadata?.deploymentUrl;
    if (typeof deploymentUrl === "string" && deploymentUrl.trim().length > 0) {
      return ["-y", "mcp-remote", deploymentUrl.trim()];
    }

    if (item.registryId === "smithery") {
      return ["-y", "@smithery/cli@latest", "run", item.sourceItemId];
    }

    return [item.sourceItemId];
  }
}
