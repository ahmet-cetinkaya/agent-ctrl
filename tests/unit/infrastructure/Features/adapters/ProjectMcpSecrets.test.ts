import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { IApplyPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ForgeCodeAdapter } from "@/infrastructure/features/forgecode/adapters/ForgeCodeAdapter";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { PiAdapter } from "@/infrastructure/features/pi/adapters/PiAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

const SECRET = "super-secret-value";
const SOURCE_DIRECTORY = ".agent-ctrl";
const PRIVATE_FILE_MODE = 0o600;

/** `envOnly` uses the secret in `env` only; `argSecret` puts it in a command argument. */
async function writeSecretServers(projectPath: string): Promise<void> {
  const mcpsDirectory = resolve(projectPath, SOURCE_DIRECTORY, "mcps");
  await writeFile(
    resolve(mcpsDirectory, "secrets.json"),
    JSON.stringify({
      mcpServers: {
        envOnly: { command: "tool", args: [], env: { API_TOKEN: "${TOKEN}" } },
        argSecret: { command: "tool", args: ["--key", "${TOKEN}"] },
      },
    }),
    "utf-8"
  );
  await writeFile(resolve(mcpsDirectory, ".env"), `TOKEN=${SECRET}\n`, "utf-8");
}

/** Every file apply wrote into the project, without the agent-ctrl source that holds the .env. */
async function readProjectOutput(projectPath: string): Promise<string> {
  const entries = await readdir(projectPath, { recursive: true, withFileTypes: true });
  const files = entries.filter(
    (entry) => entry.isFile() && !resolve(entry.parentPath, entry.name).includes(`/${SOURCE_DIRECTORY}/`)
  );
  const contents = await Promise.all(files.map((file) => readFile(resolve(file.parentPath, file.name), "utf-8")));
  return contents.join("\n");
}

async function declarePiMcpAdapter(projectPath: string): Promise<void> {
  await mkdir(resolve(projectPath, ".pi"), { recursive: true });
  await writeFile(
    resolve(projectPath, ".pi", "settings.json"),
    JSON.stringify({ packages: [{ source: "npm:pi-mcp-adapter" }] })
  );
}

describe.each([
  {
    name: "Kilo",
    build: (): IApplyPlatformAdapter => new KiloAdapter(),
    mcpFile: ".kilo/kilo.jsonc",
    serverMapKey: "mcp",
    reference: "{env:TOKEN}",
    withheld: [] as string[],
  },
  {
    name: "Qwen",
    build: (): IApplyPlatformAdapter => new QwenAdapter(),
    mcpFile: ".qwen/settings.json",
    serverMapKey: "mcpServers",
    reference: "${TOKEN}",
    withheld: ["argSecret"],
  },
  {
    name: "Gemini",
    build: (): IApplyPlatformAdapter => new GeminiAdapter(),
    mcpFile: ".gemini/settings.json",
    serverMapKey: "mcpServers",
    reference: "${TOKEN}",
    withheld: ["argSecret"],
  },
  {
    name: "ForgeCode",
    build: (): IApplyPlatformAdapter => new ForgeCodeAdapter(),
    mcpFile: ".mcp.json",
    serverMapKey: "mcpServers",
    reference: undefined,
    withheld: ["envOnly", "argSecret"],
  },
  {
    name: "Pi with pi-mcp-adapter",
    build: (): IApplyPlatformAdapter => new PiAdapter(),
    mcpFile: ".mcp.json",
    serverMapKey: "mcpServers",
    reference: "${TOKEN}",
    withheld: ["argSecret"],
  },
  {
    name: "Senpi builtin MCP",
    build: (): IApplyPlatformAdapter => PiAdapter.forSenpi(),
    mcpFile: ".senpi/mcp.json",
    serverMapKey: "mcpServers",
    reference: undefined,
    withheld: ["envOnly", "argSecret"],
  },
])("$name project MCP secrets", ({ build, mcpFile, serverMapKey, reference, withheld }) => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "project-mcp-secrets-"));
    await writeApplyFixtures(projectPath);
    await writeSecretServers(projectPath);
    await declarePiMcpAdapter(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes no resolved secret into the project", async () => {
    const result = await build().applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(await readProjectOutput(projectPath)).not.toContain(SECRET);
    for (const serverName of withheld) {
      expect(result.warnings?.some((warning) => warning.includes(serverName))).toBe(true);
    }
  });

  it("removes a resolved secret that an earlier apply left in the project file", async () => {
    const mcpPath = resolve(projectPath, mcpFile);
    await mkdir(dirname(mcpPath), { recursive: true });
    const leakedServer = { command: "tool", args: ["--key", SECRET] };
    await writeFile(mcpPath, JSON.stringify({ [serverMapKey]: { argSecret: leakedServer } }), "utf-8");

    await build().applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(await readFile(mcpPath, "utf-8")).not.toContain(SECRET);
  });

  it("writes run-time references where the platform resolves them", async () => {
    await build().applyApplyIntegration({ projectPath, targetScope: "project" });
    if (!reference) return;

    const mcpConfig = await readFile(resolve(projectPath, mcpFile), "utf-8");
    expect(mcpConfig).toContain(reference);
    expect(mcpConfig).toContain("envOnly");
  });
});

describe("user-scope MCP config file mode", () => {
  let projectPath: string;
  let userRootPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "user-mcp-mode-project-"));
    userRootPath = await mkdtemp(join(tmpdir(), "user-mcp-mode-root-"));
    await writeApplyFixtures(projectPath);
    await writeSecretServers(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
    await rm(userRootPath, { recursive: true, force: true });
  });

  it("tightens an existing world-readable config that will hold the resolved secret", async () => {
    const settingsPath = resolve(userRootPath, "settings.json");
    await writeFile(settingsPath, "{}\n", { mode: 0o644 });

    await new GeminiAdapter().applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath: userRootPath,
    });

    expect(await readFile(settingsPath, "utf-8")).toContain(SECRET);
    expect((await stat(settingsPath)).mode & 0o777).toBe(PRIVATE_FILE_MODE);
  });
});
