import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { ApplyCommand } from "@/core/application/features/apply/commands/ApplyCommand";

describe("MCP apply integration flow", () => {
  let testDir: string;
  let command: ApplyCommand;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `mcp-apply-flow-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(resolve(testDir, "rules"), { recursive: true });
    await mkdir(resolve(testDir, "skills"), { recursive: true });
    await mkdir(resolve(testDir, "agents"), { recursive: true });
    process.env.AGENT_CTRL_CLAUDE_HOME = testDir;
    command = new ApplyCommand();
  });

  afterEach(async () => {
    delete process.env.AGENT_CTRL_CLAUDE_HOME;
    await rm(testDir, { recursive: true, force: true });
  });

  it("loads valid MCP entries and isolates invalid ones", async () => {
    const mcpDir = resolve(testDir, ".agent-ctrl", "mcps");
    await mkdir(mcpDir, { recursive: true });

    await writeFile(
      resolve(mcpDir, "valid.json"),
      JSON.stringify(
        {
          mcpServers: {
            BrightData: {
              command: "npx",
              args: ["@brightdata/mcp"],
              env: { API_TOKEN: "${API_TOKEN}" },
            },
          },
        },
        null,
        2
      )
    );

    await writeFile(
      resolve(mcpDir, "invalid.json"),
      JSON.stringify(
        {
          mcpServers: {
            Broken: {
              command: "",
              args: ["x"],
              env: { API_TOKEN: "${MISSING_TOKEN}" },
            },
          },
        },
        null,
        2
      )
    );

    await writeFile(resolve(mcpDir, ".env"), "API_TOKEN=from-env\n");

    const result = await command.execute({
      projectPath: testDir,
      platform: "claude",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.mcpFilesDiscovered).toBe(2);
    expect(result.data.mcpServersLoaded).toBe(1);
    expect(result.data.mcpFilesFailed).toBeGreaterThan(0);

    const statePath = resolve(testDir, ".claude", ".agent-ctrl.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    expect(Array.isArray(state.mcpServers)).toBe(true);
    expect(state.mcpServers).toHaveLength(1);
    expect(state.mcpServers[0].name).toBe("BrightData");
    expect(state.mcpServers[0].env.API_TOKEN).toBe("from-env");

    const claudeMcpPath = resolve(testDir, ".claude.json");
    const claudeMcp = JSON.parse(await readFile(claudeMcpPath, "utf-8"));
    expect(Object.keys(claudeMcp.mcpServers)).toEqual(["BrightData"]);
    expect(claudeMcp.mcpServers.BrightData.command).toBe("npx");
    expect(claudeMcp.mcpServers.BrightData.args).toEqual(["@brightdata/mcp"]);
    expect(claudeMcp.mcpServers.BrightData.env.API_TOKEN).toBe("from-env");
  });
});
