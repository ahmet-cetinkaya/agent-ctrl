import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

describe("McpServerAggregator reference-only servers", () => {
  let projectPath: string;
  let mcpDir: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "mcp-reference-only-"));
    mcpDir = join(projectPath, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  async function writeServers(servers: Record<string, unknown>): Promise<void> {
    await writeFile(join(mcpDir, "servers.json"), JSON.stringify({ mcpServers: servers }));
  }

  async function load() {
    const result = await new McpServerAggregator().load(projectPath);
    if (!result.success) throw result.error;
    return result.data;
  }

  it("keeps a server with a missing variable as reference-only, with raw fields and a warning", async () => {
    await writeFile(join(mcpDir, ".env"), "PRESENT=secret-value\n");
    await writeServers({ demo: { command: "demo-mcp", args: [], env: { KEY: "${MISSING}", OTHER: "${PRESENT}" } } });

    const loaded = await load();

    expect(loaded.servers).toHaveLength(0);
    expect(loaded.referenceOnlyServers).toHaveLength(1);
    const [server] = loaded.referenceOnlyServers;
    expect(server.env).toEqual({ KEY: "${MISSING}", OTHER: "${PRESENT}" });
    expect(JSON.stringify(server)).not.toContain("secret-value");
    const issues = loaded.report.fileResults.flatMap((file) => file.issues);
    expect(issues.map((issue) => [issue.code, issue.severity])).toEqual([["ENV_VAR_UNRESOLVED", "warning"]]);
    expect(loaded.report.totalFailed).toBe(0);
  });

  it("treats a missing mcps/.env like a missing variable", async () => {
    await writeServers({ demo: { command: "demo-mcp", args: [], env: { KEY: "${MISSING}" } } });

    const loaded = await load();

    expect(loaded.referenceOnlyServers.map((server) => server.serverId)).toEqual(["demo"]);
    expect(loaded.servers).toHaveLength(0);
  });

  it("loads a server whose variables are all defined as before", async () => {
    await writeFile(join(mcpDir, ".env"), "PRESENT=value\n");
    await writeServers({ demo: { command: "demo-mcp", args: [], env: { KEY: "${PRESENT}" } } });

    const loaded = await load();

    expect(loaded.servers.map((server) => server.serverId)).toEqual(["demo"]);
    expect(loaded.referenceOnlyServers).toHaveLength(0);
  });

  it("still fails a server with another error next to the missing variable", async () => {
    await writeFile(join(mcpDir, ".env"), "PRESENT=value\n");
    await writeServers({ demo: { command: "demo-mcp", args: "not-an-array", env: { KEY: "${MISSING}" } } });

    const loaded = await load();

    expect(loaded.servers).toHaveLength(0);
    expect(loaded.referenceOnlyServers).toHaveLength(0);
  });

  it("never carries a value resolved from mcps/.env, not even in cwd", async () => {
    await writeFile(join(mcpDir, ".env"), "PRESENT=secret-value\n");
    await writeServers({
      demo: { command: "demo-mcp", args: [], cwd: "/srv/${PRESENT}", env: { KEY: "${MISSING}" } },
    });

    const loaded = await load();

    expect(loaded.referenceOnlyServers).toHaveLength(1);
    expect(JSON.stringify(loaded.referenceOnlyServers)).not.toContain("secret-value");
  });

  it("still fails a server that uses a variable when mcps/.env has a malformed line", async () => {
    await writeFile(join(mcpDir, ".env"), "PRESENT=value\nnot a valid line\n");
    await writeServers({ demo: { command: "demo-mcp", args: [], env: { KEY: "${MISSING}" } } });

    const loaded = await load();

    expect(loaded.servers).toHaveLength(0);
    expect(loaded.referenceOnlyServers).toHaveLength(0);
    const codes = loaded.report.fileResults.flatMap((file) => file.issues.map((issue) => issue.code));
    expect(codes).toContain("ENV_FILE_MALFORMED");
  });
});
