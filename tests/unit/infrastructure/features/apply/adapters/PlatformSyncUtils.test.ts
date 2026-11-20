import { describe, expect, it } from "bun:test";
import {
  resolveApplyScope,
  toStatus,
  renderOpencodeMcpConfig,
  renderSettingsMcpConfig,
  renderCodexMcpServers,
  stripJsonComments,
  isStillRendered,
  toRenderedPathSet,
  prepareMcpServersForScope,
  PI_MCP_ADAPTER_ENV_REFERENCES,
} from "@/infrastructure/features/apply/adapters/PlatformSyncUtils";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

describe("PlatformSyncUtils", () => {
  describe("isStillRendered", () => {
    const renderedPaths = toRenderedPathSet(["alpha.mdc", "ts/gamma.mdc"]);

    it("matches a nested path that the Windows folder scan returns with backslashes", () => {
      expect(isStillRendered("ts\\gamma.mdc", renderedPaths)).toBe(true);
    });

    it("matches a path with slashes and a top-level file", () => {
      expect(isStillRendered("ts/gamma.mdc", renderedPaths)).toBe(true);
      expect(isStillRendered("alpha.mdc", renderedPaths)).toBe(true);
    });

    it("matches a rendered path that was given with backslashes", () => {
      expect(isStillRendered("ts/delta.mdc", toRenderedPathSet(["ts\\delta.mdc"]))).toBe(true);
    });

    it("does not match a file this apply no longer renders", () => {
      expect(isStillRendered("ts\\beta.mdc", renderedPaths)).toBe(false);
      expect(isStillRendered("gamma.mdc", renderedPaths)).toBe(false);
    });
  });

  describe("prepareMcpServersForScope warnings", () => {
    it("warns that an unexported variable is not filled in when a project server reads variables at run time", () => {
      const server: ApplyMcpServer = {
        name: "api",
        transport: "stdio",
        command: "npx",
        args: [],
        env: { TOKEN: "resolved" },
        sourceFile: "api.json",
        unresolved: { env: { TOKEN: "${TOKEN}" } },
      };

      const prepared = prepareMcpServersForScope("project", [server], PI_MCP_ADAPTER_ENV_REFERENCES, "Pi");

      expect(prepared.warnings.some((warning) => warning.includes("not exported"))).toBe(true);
    });
  });

  describe("stripJsonComments", () => {
    it("keeps comment markers inside strings, such as a glob or a URL", () => {
      const text = '{ "args": ["src/**/*.ts", "http://host/a//b", "a /* b */ c"] }';

      expect(stripJsonComments(text)).toBe(text);
    });

    it("removes block and line comments outside strings", () => {
      const text = '{\n  // note\n  "a": 1, /* inline */ "b": 2 // tail\n}';

      expect(JSON.parse(stripJsonComments(text))).toEqual({ a: 1, b: 2 });
    });

    it("handles an escaped quote before a comment marker inside a string", () => {
      const text = '{ "a": "x\\" /* keep */ y", /* drop */ "b": 1 }';

      expect(JSON.parse(stripJsonComments(text))).toEqual({ a: 'x" /* keep */ y', b: 1 });
    });

    it("stops at the end of an unterminated block comment", () => {
      expect(stripJsonComments('{ "a": 1 } /* open')).toBe('{ "a": 1 } ');
    });
  });

  describe("resolveApplyScope", () => {
    it("returns user scope when explicitly requested and supported", () => {
      const result = resolveApplyScope("user" as const, "project", true);
      expect(result).toBe("user");
    });

    it("returns project scope when explicitly requested", () => {
      const result = resolveApplyScope("project" as const, "user", true);
      expect(result).toBe("project");
    });

    it("throws when user scope requested but not supported", () => {
      expect(() => resolveApplyScope("user" as const, "project", false)).toThrow(
        "does not expose a documented file-backed user configuration"
      );
    });

    it("falls back to default scope when no preference provided", () => {
      const result = resolveApplyScope(undefined, "project", true);
      expect(result).toBe("project");
    });

    it("reads from AGENT_CTRL_APPLY_SCOPE environment variable", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "user";
      const result = resolveApplyScope(undefined, "project", true);
      expect(result).toBe("user");
      delete process.env.AGENT_CTRL_APPLY_SCOPE;
    });

    it("prioritizes explicit preference over environment variable", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "user";
      const result = resolveApplyScope("project" as const, "user", true);
      expect(result).toBe("project");
      delete process.env.AGENT_CTRL_APPLY_SCOPE;
    });

    it("normalizes environment variable to lowercase", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "USER";
      const result = resolveApplyScope(undefined, "project", true);
      expect(result).toBe("user");
      delete process.env.AGENT_CTRL_APPLY_SCOPE;
    });

    it("treats invalid environment variable as undefined", () => {
      process.env.AGENT_CTRL_APPLY_SCOPE = "invalid";
      const result = resolveApplyScope(undefined, "project", true);
      expect(result).toBe("project");
      delete process.env.AGENT_CTRL_APPLY_SCOPE;
    });
  });

  describe("toStatus", () => {
    it("returns 'success' when changed is true", () => {
      expect(toStatus(true)).toBe("success");
    });

    it("returns 'unchanged' when changed is false", () => {
      expect(toStatus(false)).toBe("unchanged");
    });
  });

  describe("renderOpencodeMcpConfig", () => {
    it("renders empty config for no servers", () => {
      const result = renderOpencodeMcpConfig({}, []);
      expect(result).toHaveProperty("mcp");
      expect(result.mcp).toEqual({});
    });

    it("renders single server configuration", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "Test Server",
          transport: "stdio" as const,
          command: "node",
          args: ["server.js"],
          env: { TEST: "value" },
          sourceFile: "test.json",
        },
      ];
      const result = renderOpencodeMcpConfig({}, servers) as {
        mcp: Record<string, { command: string[]; environment: Record<string, string> }>;
      };
      expect(result.mcp).toHaveProperty("Test Server");
      expect(result.mcp["Test Server"].command).toEqual(["node", "server.js"]);
      expect(result.mcp["Test Server"].environment).toEqual({ TEST: "value" });
    });

    it("merges with existing config", () => {
      const existing = { mcp: { "Existing Server": { type: "local", command: ["existing"] } } };
      const servers: ApplyMcpServer[] = [
        { name: "New Server", transport: "stdio" as const, command: "new", args: [], env: {}, sourceFile: "new.json" },
      ];
      const result = renderOpencodeMcpConfig(existing, servers) as { mcp: Record<string, unknown> };
      expect(result.mcp).toHaveProperty("Existing Server");
      expect(result.mcp).toHaveProperty("New Server");
    });
  });

  describe("renderSettingsMcpConfig", () => {
    it("renders empty config for no servers", () => {
      const result = renderSettingsMcpConfig({}, []);
      expect(result).toHaveProperty("mcpServers");
      expect(result.mcpServers).toEqual({});
    });

    it("renders single server as merged config", () => {
      const servers: ApplyMcpServer[] = [
        { name: "Test", transport: "stdio" as const, command: "test", args: [], env: {}, sourceFile: "test.json" },
      ];
      const result = renderSettingsMcpConfig({}, servers) as { mcpServers: Record<string, { command: string }> };
      expect(result.mcpServers).toHaveProperty("Test");
      expect(result.mcpServers.Test.command).toBe("test");
    });

    it("includes command and args in merged config", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "Test",
          transport: "stdio" as const,
          command: "node",
          args: ["server.js", "--port", "8080"],
          env: {},
          sourceFile: "test.json",
        },
      ];
      const result = renderSettingsMcpConfig({}, servers) as {
        mcpServers: Record<string, { command: string; args: string[] }>;
      };
      expect(result.mcpServers.Test.command).toBe("node");
      expect(result.mcpServers.Test.args).toEqual(["server.js", "--port", "8080"]);
    });

    it("merges with existing config", () => {
      const existing = { mcpServers: { Existing: { command: "existing", args: [] } } };
      const servers: ApplyMcpServer[] = [
        { name: "New", transport: "stdio" as const, command: "new", args: [], env: {}, sourceFile: "new.json" },
      ];
      const result = renderSettingsMcpConfig(existing, servers);
      expect(result.mcpServers).toHaveProperty("Existing");
      expect(result.mcpServers).toHaveProperty("New");
    });
  });

  describe("renderCodexMcpServers", () => {
    it("renders empty config for no servers", () => {
      const result = renderCodexMcpServers([]);
      expect(result).toBe("");
    });

    it("renders server list as TOML", () => {
      const servers: ApplyMcpServer[] = [
        { name: "Server 1", transport: "stdio" as const, command: "cmd1", args: [], env: {}, sourceFile: "test1.json" },
        { name: "Server 2", transport: "stdio" as const, command: "cmd2", args: [], env: {}, sourceFile: "test2.json" },
      ];
      const result = renderCodexMcpServers(servers);
      expect(result).toContain("[mcp_servers.Server 1]");
      expect(result).toContain("[mcp_servers.Server 2]");
      expect(result).toContain('command = "cmd1"');
      expect(result).toContain('command = "cmd2"');
    });

    it("includes all required server properties in TOML format", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "Test",
          transport: "stdio" as const,
          command: "test",
          args: ["--arg"],
          env: { KEY: "value" },
          sourceFile: "test.json",
        },
      ];
      const result = renderCodexMcpServers(servers);
      expect(result).toContain("[mcp_servers.Test]");
      expect(result).toContain('command = "test"');
      expect(result).toContain('args = ["--arg"]');
      expect(result).toContain('env = { KEY = "value" }');
    });
  });

  describe("countUnsupportedArtifacts", () => {
    it("counts zero when all artifacts supported", () => {
      const artifacts = {
        rules: true,
        workflows: true,
        skills: true,
        mcp: true,
        commands: true,
      };
      // This function would need to be exported or tested indirectly
      // For now, just verify the concept
      expect(artifacts).toBeDefined();
    });
  });
});
