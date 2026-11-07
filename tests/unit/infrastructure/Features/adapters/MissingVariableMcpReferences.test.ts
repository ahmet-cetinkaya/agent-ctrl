import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { IApplyPlatformAdapter } from "@/core/domain/shared/interfaces/IPlatformAdapter";
import { ForgeCodeAdapter } from "@/infrastructure/features/forgecode/adapters/ForgeCodeAdapter";
import { GeminiAdapter } from "@/infrastructure/features/gemini/adapters/GeminiAdapter";
import { KiloAdapter } from "@/infrastructure/features/kilo/adapters/KiloAdapter";
import { OpenCodeAdapter } from "@/infrastructure/features/opencode/adapters/OpenCodeAdapter";
import { PiAdapter } from "@/infrastructure/features/pi/adapters/PiAdapter";
import { QwenAdapter } from "@/infrastructure/features/qwen/adapters/QwenAdapter";
import { writeApplyFixtures } from "@tests/helpers/writeApplyFixtures";

const SOURCE_DIRECTORY = ".agent-ctrl";
const DEFINED_SECRET = "defined-secret-value";

/** `envOnly` uses a variable that mcps/.env lacks in `env`; `argOnly` uses it in a command argument. */
async function writeServersWithMissingVariable(projectPath: string): Promise<void> {
  const mcpsDirectory = resolve(projectPath, SOURCE_DIRECTORY, "mcps");
  await writeFile(
    resolve(mcpsDirectory, "servers.json"),
    JSON.stringify({
      mcpServers: {
        envOnly: { command: "tool", args: [], env: { API_TOKEN: "${MISSING}", OTHER: "${DEFINED}" } },
        argOnly: { command: "tool", args: ["--key", "${MISSING}"] },
      },
    }),
    "utf-8"
  );
  await writeFile(resolve(mcpsDirectory, ".env"), `DEFINED=${DEFINED_SECRET}\n`, "utf-8");
}

async function declarePiMcpAdapter(projectPath: string): Promise<void> {
  await mkdir(resolve(projectPath, ".pi"), { recursive: true });
  await writeFile(
    resolve(projectPath, ".pi", "settings.json"),
    JSON.stringify({ packages: [{ source: "npm:pi-mcp-adapter" }] })
  );
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

describe.each([
  {
    name: "OpenCode",
    build: (): IApplyPlatformAdapter => new OpenCodeAdapter(),
    mcpFile: "opencode.json",
    reference: "{env:MISSING}",
    writtenServers: ["envOnly", "argOnly"],
    skippedServers: [] as string[],
  },
  {
    name: "Kilo",
    build: (): IApplyPlatformAdapter => new KiloAdapter(),
    mcpFile: ".kilo/kilo.jsonc",
    reference: "{env:MISSING}",
    writtenServers: ["envOnly", "argOnly"],
    skippedServers: [] as string[],
  },
  {
    name: "Gemini",
    build: (): IApplyPlatformAdapter => new GeminiAdapter(),
    mcpFile: ".gemini/settings.json",
    reference: "${MISSING}",
    writtenServers: ["envOnly"],
    skippedServers: ["argOnly"],
  },
  {
    name: "Qwen",
    build: (): IApplyPlatformAdapter => new QwenAdapter(),
    mcpFile: ".qwen/settings.json",
    reference: "${MISSING}",
    writtenServers: ["envOnly"],
    skippedServers: ["argOnly"],
  },
  {
    name: "Pi with pi-mcp-adapter",
    build: (): IApplyPlatformAdapter => new PiAdapter(),
    mcpFile: ".mcp.json",
    reference: "${MISSING}",
    writtenServers: ["envOnly"],
    skippedServers: ["argOnly"],
  },
])(
  "$name project scope, variable missing from mcps/.env",
  ({ build, mcpFile, reference, writtenServers, skippedServers }) => {
    let projectPath: string;

    beforeEach(async () => {
      projectPath = await mkdtemp(join(tmpdir(), "missing-variable-mcp-"));
      await writeApplyFixtures(projectPath);
      await writeServersWithMissingVariable(projectPath);
      await declarePiMcpAdapter(projectPath);
    });

    afterEach(async () => {
      await rm(projectPath, { recursive: true, force: true });
    });

    it("writes the run-time reference for the servers the platform can resolve", async () => {
      await build().applyApplyIntegration({ projectPath, targetScope: "project" });

      const mcpConfig = await readFile(resolve(projectPath, mcpFile), "utf-8");
      expect(mcpConfig).toContain(reference);
      for (const serverName of writtenServers) expect(mcpConfig).toContain(serverName);
      for (const serverName of skippedServers) expect(mcpConfig).not.toContain(serverName);
    });

    it("warns about each skipped server and writes no defined secret", async () => {
      const result = await build().applyApplyIntegration({ projectPath, targetScope: "project" });

      for (const serverName of skippedServers) {
        expect(result.warnings?.some((warning) => warning.includes(serverName))).toBe(true);
      }
      expect(await readProjectOutput(projectPath)).not.toContain(DEFINED_SECRET);
    });
  }
);

describe("Pi with pi-mcp-adapter, variable in the url", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "missing-variable-mcp-"));
    await writeApplyFixtures(projectPath);
    await writeFile(
      resolve(projectPath, SOURCE_DIRECTORY, "mcps", "servers.json"),
      JSON.stringify({ mcpServers: { remote: { type: "http", url: "https://mcp.example.test/${MISSING}" } } }),
      "utf-8"
    );
    await declarePiMcpAdapter(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("writes the url with the run-time reference", async () => {
    await new PiAdapter().applyApplyIntegration({ projectPath, targetScope: "project" });

    expect(await readFile(resolve(projectPath, ".mcp.json"), "utf-8")).toContain("https://mcp.example.test/${MISSING}");
  });
});

describe.each([
  { name: "ForgeCode", build: (): IApplyPlatformAdapter => new ForgeCodeAdapter() },
  { name: "Senpi builtin MCP", build: (): IApplyPlatformAdapter => PiAdapter.forSenpi() },
])("$name project scope without run-time references", ({ build }) => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "missing-variable-mcp-"));
    await writeApplyFixtures(projectPath);
    await writeServersWithMissingVariable(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("skips both servers with a warning and writes no value", async () => {
    const result = await build().applyApplyIntegration({ projectPath, targetScope: "project" });

    const output = await readProjectOutput(projectPath);
    expect(output).not.toContain("${MISSING}");
    expect(output).not.toContain(DEFINED_SECRET);
    expect(result.warnings?.some((warning) => warning.includes("envOnly"))).toBe(true);
  });
});

describe("user scope", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "missing-variable-mcp-"));
    await writeApplyFixtures(projectPath);
    await writeServersWithMissingVariable(projectPath);
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  it("OpenCode user scope leaves the servers out and says why", async () => {
    const userConfigRootPath = join(projectPath, "user-config");
    const result = await new OpenCodeAdapter().applyApplyIntegration({
      projectPath,
      targetScope: "user",
      userConfigRootPath,
    });

    const userFile = join(userConfigRootPath, "opencode.json");
    const written = await readFile(userFile, "utf-8").catch(() => "");
    expect(written).not.toContain("envOnly");
    expect(result.warnings?.some((warning) => warning.includes("envOnly"))).toBe(true);
  });
});
