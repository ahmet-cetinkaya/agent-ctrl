import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

describe("OpenCodeAdapter", () => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: OpenCodeAdapter;
  let tempCommandPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "opencode-adapter-"));
    userRootPath = await mkdtemp(join(tmpdir(), "opencode-user-root-"));
    await writeApplyFixtures(projectPath);
    adapter = new OpenCodeAdapter();
    // Create a temp command that won't be in the project
    tempCommandPath = resolve(userRootPath, "commands", "dev", "temp-command.md");
    const commandsDir = resolve(userRootPath, "commands", "dev");
    await mkdir(commandsDir, { recursive: true });
    await writeFile(tempCommandPath, "# Temp Command\n\nA temporary command for testing.");
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("syncs OpenCode native files", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("success");
    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));

    const content = await readFile(result.configPath, "utf-8");
    expect(content).toContain("<!-- agent-ctrl:opencode:start -->");
    expect(content).toContain("## Coding Style");
    await expect(access(resolve(projectPath, ".opencode", "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, ".opencode", "agents", "architect.md"))).resolves.toBeNull();
  });

  it("preserves unchanged state on rerun", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    expect(result.status).toBe("unchanged");
  });

  it("writes user scope artifacts directly into the OpenCode config root", async () => {
    const result = await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(result.status).toBe("success");
    expect(result.scope).toBe("user");
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));

    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "agents", "architect.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "opencode.json"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, ".opencode"))).rejects.toBeDefined();
  });

  it("renders a Claude-style tools array in agent frontmatter as a deny-first permission map", async () => {
    await writeFile(
      resolve(projectPath, ".agent-ctrl", "agents", "architect.md"),
      [
        "---",
        "name: architect",
        "description: Software architecture specialist",
        'tools: ["Read", "Grep", "Glob"]',
        "---",
        "",
        "Be explicit.",
      ].join("\n"),
      "utf-8"
    );

    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    const content = await readFile(resolve(projectPath, ".opencode", "agents", "architect.md"), "utf-8");
    expect(content).toContain("read: allow");
    expect(content).toContain("grep: allow");
    expect(content).toContain("glob: allow");
    expect(content).toContain('"*": deny');
    expect(content).not.toContain("tools:");
  });

  describe("MCP secrets (GH #24)", () => {
    const SECRET = "super-secret-value";

    async function writeSecretServer(): Promise<void> {
      const mcpsDir = resolve(projectPath, ".agent-ctrl", "mcps");
      await writeFile(
        resolve(mcpsDir, "tokened.json"),
        JSON.stringify({
          mcpServers: {
            tokened: { command: "tool", args: ["--key", "${TOKEN}"], env: { API_TOKEN: "${TOKEN}" } },
            remote: { type: "http", url: "https://example.test/mcp?key=${TOKEN}" },
          },
        }),
        "utf-8"
      );
      await writeFile(resolve(mcpsDir, ".env"), `TOKEN=${SECRET}\n`, "utf-8");
    }

    it("keeps secrets out of the project opencode.json and writes {env:VAR} references", async () => {
      await writeSecretServer();

      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

      const projectConfig = await readFile(resolve(projectPath, "opencode.json"), "utf-8");
      expect(projectConfig).not.toContain(SECRET);
      const mcp = JSON.parse(projectConfig).mcp;
      expect(mcp.tokened.environment.API_TOKEN).toBe("{env:TOKEN}");
      expect(mcp.tokened.command).toEqual(["tool", "--key", "{env:TOKEN}"]);
      expect(mcp.remote.url).toBe("https://example.test/mcp?key={env:TOKEN}");
      expect((result.warnings ?? []).some((warning) => warning.includes("TOKEN"))).toBe(true);
    });

    it("keeps resolved values in the private user-scope config", async () => {
      await writeSecretServer();

      await adapter.applyApplyIntegration({ projectPath, targetScope: "user", userConfigRootPath: userRootPath });

      const mcp = JSON.parse(await readFile(resolve(userRootPath, "opencode.json"), "utf-8")).mcp;
      expect(mcp.tokened.environment.API_TOKEN).toBe(SECRET);
    });
  });

  it("cleans existing managed artifacts when override is enabled", async () => {
    // First apply without override
    await adapter.applyApplyIntegration({ projectPath, targetScope: "user", userConfigRootPath: userRootPath });

    // Verify temp command exists
    await expect(access(tempCommandPath)).resolves.toBeNull();

    // Apply with override - should clean existing artifacts and replace with project artifacts
    await adapter.applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
      override: true,
    });

    // Verify temp command was removed (project doesn't have it)
    await expect(access(tempCommandPath)).rejects.toBeDefined();

    // Verify project artifacts were applied
    await expect(access(resolve(userRootPath, "commands", "dev", "fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(userRootPath, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
  });
});
