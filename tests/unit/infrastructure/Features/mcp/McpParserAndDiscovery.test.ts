import { describe, it, expect } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpFileDiscovery } from "@/infrastructure/features/mcp/loaders/McpFileDiscovery";
import { McpServersParser } from "@/infrastructure/features/mcp/parsers/McpServersParser";

describe("Mcp parser and discovery", () => {
  it("discovers JSON files in deterministic order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-discovery-"));

    try {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "b.json"), "{}\n");
      await writeFile(join(dir, "a.json"), "{}\n");
      await writeFile(join(dir, "note.txt"), "x\n");

      const discovery = new McpFileDiscovery();
      const files = await discovery.discover(dir);
      expect(files.map((path) => path.split("/").pop())).toEqual(["a.json", "b.json"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("parses valid mcpServers and reports invalid roots", () => {
    const parser = new McpServersParser();

    const okResult = parser.parse("/tmp/test.json", {
      mcpServers: {
        alpha: { command: "npx", args: ["alpha"] },
      },
    });
    expect(okResult.issues).toHaveLength(0);
    expect(okResult.servers).toHaveLength(1);

    const badResult = parser.parse("/tmp/test.json", ["not-object"]);
    expect(badResult.issues.some((issue) => issue.code === "MCP_INVALID_JSON_ROOT")).toBe(true);
  });

  it("handles empty mcpServers object without errors", () => {
    const parser = new McpServersParser();
    const result = parser.parse("/tmp/empty.json", {
      mcpServers: {},
    });

    expect(result.issues).toHaveLength(0);
    expect(result.servers).toHaveLength(0);
  });
});
