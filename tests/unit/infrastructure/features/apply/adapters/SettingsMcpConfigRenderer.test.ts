import { describe, it, expect } from "bun:test";
import { SettingsMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/SettingsMcpConfigRenderer";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

describe("SettingsMcpConfigRenderer", () => {
  const renderer = new SettingsMcpConfigRenderer();

  describe("renderConfig", () => {
    it("should merge servers into existing mcpServers", () => {
      const existing = {
        mcpServers: {
          "existing-server": {
            command: "existing",
            args: [],
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

      expect(result).toHaveProperty("mcpServers");
      expect(result.mcpServers).toHaveProperty("existing-server");
      expect(result.mcpServers).toHaveProperty("new-server");
    });

    it("should filter out non-stdio servers", () => {
      const existing = { mcpServers: {} };

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

      expect(result.mcpServers).toHaveProperty("stdio-server");
      expect(result.mcpServers).not.toHaveProperty("sse-server");
    });

    it("should include server with cwd", () => {
      const existing = { mcpServers: {} };

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

      const result = renderer.renderConfig(existing, servers) as { mcpServers: Record<string, { cwd: string }> };

      expect(result.mcpServers["test-server"].cwd).toBe("/path/to/project");
    });

    it("should include server with env variables", () => {
      const existing = { mcpServers: {} };

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
        mcpServers: Record<string, { env: Record<string, string> }>;
      };

      expect(result.mcpServers["env-server"].env).toEqual({ API_KEY: "secret", DEBUG: "true" });
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

      expect(result).toHaveProperty("mcpServers");
    });

    it("should handle non-object existing.mcpServers", () => {
      const existing = { mcpServers: "invalid" };

      const servers: ApplyMcpServer[] = [
        {
          name: "test",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers) as { mcpServers: Record<string, unknown> };

      expect(result.mcpServers).toHaveProperty("test");
    });

    it("should create correct args array format", () => {
      const existing = { mcpServers: {} };

      const servers: ApplyMcpServer[] = [
        {
          name: "cmd-server",
          transport: "stdio",
          command: "python",
          args: ["-m", "module", "arg1"],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderConfig(existing, servers) as { mcpServers: Record<string, { args: string[] }> };

      expect(result.mcpServers["cmd-server"].args).toEqual(["-m", "module", "arg1"]);
    });
  });
});
