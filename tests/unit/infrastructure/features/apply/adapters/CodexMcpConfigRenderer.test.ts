import { describe, it, expect } from "bun:test";
import { CodexMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/CodexMcpConfigRenderer";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

describe("CodexMcpConfigRenderer", () => {
  const renderer = new CodexMcpConfigRenderer();

  describe("renderConfig", () => {
    it("should throw error indicating renderToString should be used", () => {
      expect(() => renderer.renderConfig({}, [])).toThrow("Codex uses renderToString() instead of renderConfig()");
    });
  });

  describe("renderToString", () => {
    it("should render single stdio server", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain("[mcp_servers.test-server]");
      expect(result).toContain('command = "node"');
      expect(result).toContain('args = ["server.js"]');
    });

    it("should render server with cwd", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "python",
          args: ["-m", "server"],
          cwd: "/path/to/server",
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain('cwd = "/path/to/server"');
    });

    it("should render server with env variables", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "python",
          args: [],
          env: { API_KEY: "secret", DEBUG: "true" },
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain('env = { API_KEY = "secret", DEBUG = "true" }');
    });

    it("should filter out non-stdio servers", () => {
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

      const result = renderer.renderToString(servers);

      expect(result).toContain("[mcp_servers.stdio-server]");
      expect(result).not.toContain("sse-server");
    });

    it("should render multiple servers", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "server1",
          transport: "stdio",
          command: "node",
          args: ["s1.js"],
          sourceFile: "/path/to/source.ts",
        },
        {
          name: "server2",
          transport: "stdio",
          command: "python",
          args: ["-m", "s2"],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain("[mcp_servers.server1]");
      expect(result).toContain("[mcp_servers.server2]");
    });

    it("should handle empty args array", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "node",
          args: [],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain("[mcp_servers.test-server]");
      expect(result).toContain('command = "node"');
      // Should not include args line when empty
      expect(result).not.toContain("args = ");
    });

    it("should escape strings in TOML format", () => {
      const servers: ApplyMcpServer[] = [
        {
          name: "test-server",
          transport: "stdio",
          command: "path with spaces",
          args: ['arg with "quotes"'],
          sourceFile: "/path/to/source.ts",
        },
      ];

      const result = renderer.renderToString(servers);

      expect(result).toContain("command =");
      expect(result).toContain("args = ");
    });
  });
});
