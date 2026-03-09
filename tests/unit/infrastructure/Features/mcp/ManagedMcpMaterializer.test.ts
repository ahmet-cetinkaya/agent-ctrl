import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { ManagedMcpMaterializer } from "@/infrastructure/features/mcp/metadata/ManagedMcpMaterializer";
import type { CatalogItem } from "@/core/domain/shared/entities";

describe("ManagedMcpMaterializer", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it("writes only mcpServers payload and falls back to remote transport args for deploymentUrl entries", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "managed-mcp-materializer-"));
    tempDirs.push(baseDir);
    const configRoot = resolve(baseDir, ".agent-ctrl");
    await mkdir(resolve(configRoot, "mcps"), { recursive: true });

    const item: CatalogItem = {
      catalogKey: "smithery:upstash/context7-mcp",
      registryId: "smithery",
      itemType: "mcp",
      sourceItemId: "upstash/context7-mcp",
      displayName: "Context7",
      capabilities: [],
      categories: [],
      availabilityState: "available",
      compatibilityState: "unknown",
      activationState: "inactive",
      lastSeenAt: new Date().toISOString(),
      metadata: {
        command: "npx",
        args: [],
        deploymentUrl: "https://context7-mcp--upstash.run.tools",
      },
    };

    const result = await new ManagedMcpMaterializer().install(configRoot, item);
    const file = JSON.parse(await readFile(result.localPath, "utf-8")) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
      agentCtrl?: unknown;
    };

    expect(file.agentCtrl).toBeUndefined();
    expect(file.mcpServers["upstash/context7-mcp"]).toBeDefined();
    expect(file.mcpServers["upstash/context7-mcp"].command).toBe("npx");
    expect(file.mcpServers["upstash/context7-mcp"].args).toEqual([
      "-y",
      "mcp-remote",
      "https://context7-mcp--upstash.run.tools",
    ]);
  });
});
