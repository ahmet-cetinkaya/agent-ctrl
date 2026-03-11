import { describe, it, expect } from "bun:test";
import { OpenCodeMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeMcpConfigRenderer";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

describe("OpenCodeMcpConfigRenderer", () => {
  const renderer = new OpenCodeMcpConfigRenderer();

  describe("renderConfig", () => {
    it("should merge servers into existing config", () => {
      const existing = {
        $schema: "https://example.com/schema.json",
        mcp: {
          "existing-server": {
            type: "local",
            command: ["existing"],
            enabled: true,
          },
        },
      };

      const servers: ApplyMcpServer[] = [
        {
          name: "new-server",
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers);

      expect(result).toHaveProperty("mcp");
      expect(result.$schema).toBe("https://example.com/schema.json");
      expect(result.mcp).toHaveProperty("existing-server");
      expect(result.mcp).toHaveProperty("new-server");
    });

    it("should filter out non-stdio servers", () => {
      const existing = { mcp: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "stdio-server",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
        {
          name: "sse-server",
          transport: "http",
          url: "http://localhost:3000",
          sourceFile: "/path/to/source.ts",
        } as unknown as ApplyMcpServer,
      ];

      const result = renderer.renderConfig(existing, servers);

      expect(result.mcp).toHaveProperty("stdio-server");
      expect(result.mcp).not.toHaveProperty("sse-server");
    });

    it("should include server with cwd", () => {
      const existing = { mcp: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "python",
          args: ["-m", "server"],
          cwd: "/path/to/project",
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers) as { mcp: Record<string, { cwd: string }> };

      expect(result.mcp["test-server"].cwd).toBe("/path/to/project");
    });

    it("should include server with env variables", () => {
      const existing = { mcp: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "env-server",
          transport: "stdio",
          command: "node",
          args: [],
          env: { API_KEY: "secret", DEBUG: "true" },
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers) as {
        mcp: Record<string, { environment: Record<string, string> }>;
      };

      expect(result.mcp["env-server"].environment).toEqual({ API_KEY: "secret", DEBUG: "true" });
    });

    it("should handle empty existing config", () => {
      const existing = {};

      const servers: ApplyMcpServer[] = [
        {
          name: "test",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers);

      expect(result).toHaveProperty("mcp");
      expect(result.$schema).toBe("https://opencode.ai/config.json");
    });

    it("should handle non-object existing.mcp", () => {
      const existing = { mcp: "invalid" };

      const servers: ApplyMcpServer[] = [
        {
          name: "test",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers);

      expect(result.mcp).toHaveProperty("test");
    });

    it("should use default schema when existing.$schema is not a string", () => {
      const existing = { $schema: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "test",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers);

      expect(result.$schema).toBe("https://opencode.ai/config.json");
    });

    it("should create correct command array format", () => {
      const existing = { mcp: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "cmd-server",
          transport: "stdio",
          command: "python",
          args: ["-m", "module", "arg1", "arg2"],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers) as { mcp: Record<string, { command: string[] }> };

      expect(result.mcp["cmd-server"].command).toEqual(["python", "-m", "module", "arg1", "arg2"]);
    });
  });
});
