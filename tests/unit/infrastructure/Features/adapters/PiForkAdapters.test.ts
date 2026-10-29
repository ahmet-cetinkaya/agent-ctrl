import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { PiAdapter } from "@/infrastructure/features/pi/adapters/PiAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

/**
 * Brand-contract tests for the Pi-family forks: senpi (`@code-yeongyu/senpi`) and
 * OmO Native (`omo-ai`). Both keep pi's engine layout but brand it — config dir
 * `.senpi` / `.omo`, agent dir `~/.senpi/agent` / `~/.omo/agent`, their own
 * `*_CODING_AGENT_DIR` env override (pi's still readable as a legacy prefix), and
 * MCP built into the engine (`mcp.json`, `{ mcpServers: ... }` shape) so no
 * `pi-mcp-adapter` package detection gates it.
 *
 * Facts verified against the installed packages: senpi `package.json`
 * `piConfig: { configDir: ".senpi", name: "senpi" }` and `dist/core/brand.js`
 * `LEGACY_ENV_PREFIXES = ["SENPI", "PI"]`; omo-ai `bin/lib/agent-dir.js`
 * `AGENT_DIR_ENV_NAMES = ["OMO_...", "SENPI_...", "PI_..."]` with
 * `brandProfile.configDir = ".omo"`.
 */
describe.each([
  {
    name: "SenpiAdapter",
    build: () => PiAdapter.forSenpi(),
    platform: "senpi",
    configDir: ".senpi",
    envName: "SENPI_CODING_AGENT_DIR",
  },
  {
    name: "OmoNativeAdapter",
    build: () => PiAdapter.forOmoNative(),
    platform: "omonative",
    configDir: ".omo",
    envName: "OMO_CODING_AGENT_DIR",
  },
])("$name", ({ build, platform, configDir, envName }) => {
  let projectPath: string;
  let userRootPath: string;
  let adapter: PiAdapter;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), `${platform}-project-`));
    userRootPath = await mkdtemp(join(tmpdir(), `${platform}-user-`));
    await writeApplyFixtures(projectPath);
    adapter = build();
  });

  afterEach(async () => {
    delete process.env.SENPI_CODING_AGENT_DIR;
    delete process.env.OMO_CODING_AGENT_DIR;
    delete process.env.PI_CODING_AGENT_DIR;
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("reports the branded platform name and surface", async () => {
    expect(adapter.platformName).toBe(platform);
    const target = await adapter.resolveTarget(projectPath);
    expect(target.surface).toBe(`${platform}-agents-md-prompts-skills`);
  });

  it("writes project-scope prompts/skills under the branded config dir", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(result.scope).toBe("project");
    expect(result.configPath).toBe(resolve(projectPath, "AGENTS.md"));
    await expect(access(resolve(projectPath, configDir, "prompts", "dev-fix-lint.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, configDir, "skills", "git-workflow", "SKILL.md"))).resolves.toBeNull();
    await expect(access(resolve(projectPath, configDir, "skills", "architect", "SKILL.md"))).resolves.toBeNull();
  });

  it(`resolves the user root through ${envName}`, async () => {
    process.env[envName] = userRootPath;
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "user", dryRun: true });
    expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
  });

  it(`prefers ${envName} over the legacy PI_CODING_AGENT_DIR`, async () => {
    const legacyDir = await mkdtemp(join(tmpdir(), `${platform}-legacy-`));
    process.env.PI_CODING_AGENT_DIR = legacyDir;
    process.env[envName] = userRootPath;
    try {
      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "user", dryRun: true });
      expect(result.configPath).toBe(resolve(userRootPath, "AGENTS.md"));
    } finally {
      await rm(legacyDir, { recursive: true, force: true });
    }
  });

  it("still reads the legacy PI_CODING_AGENT_DIR when the branded one is unset", async () => {
    const legacyDir = await mkdtemp(join(tmpdir(), `${platform}-legacy2-`));
    process.env.PI_CODING_AGENT_DIR = legacyDir;
    try {
      const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "user", dryRun: true });
      expect(result.configPath).toBe(resolve(legacyDir, "AGENTS.md"));
    } finally {
      await rm(legacyDir, { recursive: true, force: true });
    }
  });

  it("applies MCP servers natively to .<configDir>/mcp.json without any package declaration", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(result.warnings!.some((w) => w.includes("MCP servers were not applied"))).toBe(false);
    expect(result.artifactCounts!.mcpServers).toBeGreaterThan(0);
    expect(result.message).toContain("builtin MCP config");

    const mcpConfig = JSON.parse(await readFile(resolve(projectPath, configDir, "mcp.json"), "utf-8"));
    expect(mcpConfig.mcpServers.context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    });
  });

  it("applies user-scope MCP to <agentDir>/mcp.json and merges with existing servers", async () => {
    process.env[envName] = userRootPath;
    await mkdir(resolve(userRootPath), { recursive: true });
    await writeFile(
      resolve(userRootPath, "mcp.json"),
      JSON.stringify({ mcpServers: { existing: { command: "foo" } } })
    );

    await adapter.applyApplyIntegration({ projectPath, targetScope: "user" });

    const mcpConfig = JSON.parse(await readFile(resolve(userRootPath, "mcp.json"), "utf-8"));
    expect(mcpConfig.mcpServers.existing).toEqual({ command: "foo" });
    expect(mcpConfig.mcpServers.context7).toEqual({
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    });
  });

  it("detects pi-subagents in the branded project settings and writes native agents", async () => {
    await mkdir(resolve(projectPath, configDir), { recursive: true });
    await writeFile(
      resolve(projectPath, configDir, "settings.json"),
      JSON.stringify({ packages: [{ source: "npm:pi-subagents" }] })
    );

    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(result.warnings!.some((w) => w.includes("Agents are being written as skills"))).toBe(false);
    const agentContent = await readFile(resolve(projectPath, configDir, "agents", "architect.md"), "utf-8");
    expect(agentContent).toContain("name: architect");
  });

  it("uses branded managed-section markers in AGENTS.md", async () => {
    await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const agentsMd = await readFile(resolve(projectPath, "AGENTS.md"), "utf-8");
    expect(agentsMd).toContain(`<!-- agent-ctrl:${platform}:start -->`);
    expect(agentsMd).toContain(`<!-- agent-ctrl:${platform}:end -->`);
    expect(agentsMd).not.toContain("<!-- agent-ctrl:pi:start -->");
  });

  it("targets the config dir (not the agent dir) for settings/<platform>/ copies", async () => {
    process.env[envName] = userRootPath;
    await mkdir(resolve(projectPath, ".agent-ctrl", "settings", platform), { recursive: true });
    await writeFile(resolve(projectPath, ".agent-ctrl", "settings", platform, "settings.json"), "{}");

    const { ApplyCommand } = await import("@/core/application/features/apply/commands/ApplyCommand");
    const { PlatformAdapterRegistry } =
      await import("@/infrastructure/features/apply/adapters/PlatformAdapterRegistry");
    const registry = new PlatformAdapterRegistry();
    const command = new ApplyCommand(registry);
    const result = await command.execute({ projectPath, platform });

    expect(result.success).toBe(true);
    const settingsPath = resolve(userRootPath, "..", "settings.json");
    await expect(access(settingsPath)).resolves.toBeNull();
    // And NOT into the agent dir itself.
    const inAgentDir = await access(resolve(userRootPath, "settings.json"))
      .then(() => true)
      .catch(() => false);
    expect(inAgentDir).toBe(false);
  });

  it("names the brand's own CLI in the pi-subagents install hint", async () => {
    const result = await adapter.applyApplyIntegration({ projectPath, targetScope: "project" });
    const installCommand = platform === "senpi" ? "senpi" : "omo";
    expect(result.warnings!.some((w) => w.includes(`${installCommand} install npm:pi-subagents`))).toBe(true);
  });
});
