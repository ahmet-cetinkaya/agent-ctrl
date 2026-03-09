import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { McpPlaceholderResolver } from "@/infrastructure/features/mcp/interpolation/McpPlaceholderResolver";
import { McpEnvFileLoader } from "@/infrastructure/features/mcp/loaders/McpEnvFileLoader";
import { McpFileDiscovery } from "@/infrastructure/features/mcp/loaders/McpFileDiscovery";
import { McpFileReader } from "@/infrastructure/features/mcp/loaders/McpFileReader";
import { McpPathResolver } from "@/infrastructure/features/mcp/loaders/McpPathResolver";
import { McpServerEnvComposer } from "@/infrastructure/features/mcp/loaders/McpServerEnvComposer";
import { McpServersParser } from "@/infrastructure/features/mcp/parsers/McpServersParser";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";
import { McpPlaceholderValidation } from "@/infrastructure/features/mcp/validators/McpPlaceholderValidation";
import { McpServerEntryValidator } from "@/infrastructure/features/mcp/validators/McpServerEntryValidator";

describe("MCP coverage boost", () => {
  let workspace: string;
  let originalError: typeof console.error;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "mcp-coverage-"));
    originalError = console.error;
  });

  afterEach(async () => {
    console.error = originalError;
    delete process.env.AGENT_CTRL_CONFIG_DIR;
    await rm(workspace, { recursive: true, force: true });
  });

  it("covers placeholder resolver object/array/prototype-guard branches", () => {
    const resolver = new McpPlaceholderResolver();

    const resolved = resolver.resolve(
      {
        token: "${TOKEN}",
        nested: ["${A}", 5],
        __proto__: "${BAD}",
        constructor: "${BAD2}",
      },
      { TOKEN: "ok", A: "one" }
    ) as Record<string, unknown>;

    expect(resolved.token).toBe("ok");
    expect(resolved.nested).toEqual(["one", 5]);
    expect(Object.prototype.hasOwnProperty.call(resolved, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(resolved, "constructor")).toBe(false);
    expect(resolver.resolve(7, {})).toBe(7);
  });

  it("covers env loader missing and unexpected read errors", async () => {
    const loader = new McpEnvFileLoader();
    const missing = await loader.load(resolve(workspace, "missing.env"));
    expect(missing.exists).toBe(false);

    const dirPath = resolve(workspace, "env-dir");
    await mkdir(dirPath, { recursive: true });
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    const unexpected = await loader.load(dirPath);
    expect(unexpected.exists).toBe(false);
    expect(logs.some((line) => line.includes("Unexpected error"))).toBe(true);
  });

  it("covers file discovery ENOENT and ENOTDIR cases", async () => {
    const discovery = new McpFileDiscovery();

    const missingFiles = await discovery.discover(resolve(workspace, "does-not-exist"));
    expect(missingFiles).toEqual([]);

    const filePath = resolve(workspace, "not-dir");
    await writeFile(filePath, "x", "utf-8");
    const notDir = await discovery.discover(resolve(filePath, "child"));
    expect(notDir).toEqual([]);
  });

  it("covers file discovery unexpected-error logging path", async () => {
    const discovery = new McpFileDiscovery();
    const blockedDir = resolve(workspace, "blocked");
    await mkdir(blockedDir, { recursive: true });
    const logs: string[] = [];
    console.error = (...args: unknown[]) => {
      logs.push(args.map(String).join(" "));
    };

    try {
      await chmod(blockedDir, 0o000);
      const files = await discovery.discover(blockedDir);
      expect(files).toEqual([]);
      expect(logs.some((line) => line.includes("Unexpected error discovering MCP files"))).toBe(true);
    } finally {
      await chmod(blockedDir, 0o755);
    }
  });

  it("covers file reader valid and invalid json", async () => {
    const reader = new McpFileReader();
    const validPath = resolve(workspace, "valid.json");
    const invalidPath = resolve(workspace, "invalid.json");

    await writeFile(validPath, '{"a":1}', "utf-8");
    await writeFile(invalidPath, "{bad", "utf-8");

    const parsed = await reader.readJson(validPath);
    expect(parsed).toEqual({ a: 1 });
    await expect(reader.readJson(invalidPath)).rejects.toBeDefined();
  });

  it("covers path resolver absolute and relative configured roots", async () => {
    const resolver = new McpPathResolver();
    const projectPath = resolve(workspace, "project");
    await mkdir(projectPath, { recursive: true });

    process.env.AGENT_CTRL_CONFIG_DIR = "/tmp/global-agent-ctrl";
    const absolutePaths = resolver.resolve(projectPath);
    expect(absolutePaths.configRoot).toBe("/tmp/global-agent-ctrl");

    process.env.AGENT_CTRL_CONFIG_DIR = ".config-root";
    const relativePaths = resolver.resolve(projectPath);
    expect(relativePaths.configRoot).toBe(resolve(projectPath, ".config-root"));
  });

  it("covers env composer with and without server override", () => {
    const composer = new McpServerEnvComposer();
    // Without args/command, base env vars are filtered out (only server-specific vars included)
    const baseOnly = composer.compose({ A: "1" });
    expect(baseOnly).toEqual({});

    // Server env vars override and are always included
    const overridden = composer.compose({ A: "1", B: "2" }, { A: "X" });
    expect(overridden).toEqual({ A: "X" });
  });

  it("covers servers parser missing mcpServers and invalid server object", () => {
    const parser = new McpServersParser();

    const missing = parser.parse("/tmp/test.json", {});
    expect(missing.issues.some((issue) => issue.code === "MCP_SERVERS_MISSING")).toBe(true);

    const invalidServer = parser.parse("/tmp/test.json", {
      mcpServers: {
        bad: "not-object",
      },
    });
    expect(invalidServer.issues.some((issue) => issue.code === "MCP_SERVER_INVALID")).toBe(true);
  });

  it("covers error formatter sanitization patterns", () => {
    const formatter = new McpErrorFormatter();
    const issue = formatter.createIssue({
      severity: "error",
      code: "E",
      message: "api_key=abc token:xyz secret=123",
      filePath: "/tmp/a.json",
    });

    expect(issue.message).toContain("api_key=[REDACTED]");
    expect(issue.message).toContain("token:[REDACTED]");
    expect(issue.message).toContain("secret=[REDACTED]");
  });

  it("covers placeholder validation env-missing and no-issue paths", () => {
    const validator = new McpPlaceholderValidation();

    const missingEnvIssues = validator.validate(
      [{ token: "${A}", variableName: "A", jsonPath: "$.x" }],
      {},
      "/tmp/f.json",
      "srv",
      false
    );
    expect(missingEnvIssues.some((issue) => issue.code === "ENV_FILE_MISSING")).toBe(true);

    const noIssues = validator.validate([], {}, "/tmp/f.json", "srv", false);
    expect(noIssues).toEqual([]);

    const resolved = validator.validate(
      [{ token: "${A}", variableName: "A", jsonPath: "$.x" }],
      { A: "1" },
      "/tmp/f.json",
      "srv",
      true
    );
    expect(resolved).toEqual([]);
  });

  it("covers server entry validator valid and invalid branches", () => {
    const validator = new McpServerEntryValidator();

    const valid = validator.validate("srv", "/tmp/f.json", {
      command: "npx",
      args: ["x"],
      cwd: "/tmp",
      env: { A: "1" },
    });
    expect(valid.issues).toEqual([]);
    expect(valid.validated?.command).toBe("npx");

    const invalidCwd = validator.validate("srv", "/tmp/f.json", {
      command: "npx",
      args: ["x"],
      cwd: 5,
    });
    expect(invalidCwd.issues.some((issue) => issue.code === "MCP_CWD_INVALID")).toBe(true);

    const invalidEnvObj = validator.validate("srv", "/tmp/f.json", {
      command: "npx",
      args: ["x"],
      env: "bad",
    });
    expect(invalidEnvObj.issues.some((issue) => issue.code === "MCP_ENV_INVALID")).toBe(true);
  });
});
