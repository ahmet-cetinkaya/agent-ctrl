import { describe, it, expect, beforeEach } from "bun:test";
import { BaseMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/BaseMcpConfigRenderer";
import type { ApplyMcpServer } from "@/infrastructure/features/apply/adapters/ApplySourceLoader";

class TestableMcpConfigRenderer extends BaseMcpConfigRenderer {
  renderConfig(existing: Record<string, unknown>, servers: ApplyMcpServer[]): Record<string, unknown> {
    return { filtered: this.filterStdioServers(servers), isObj: this.isObject(existing) };
  }

  public filterStdioServersPublic(servers: ApplyMcpServer[]): ApplyMcpServer[] {
    return this.filterStdioServers(servers);
  }

  public isObjectPublic(value: unknown): boolean {
    return this.isObject(value);
  }
}

describe("BaseMcpConfigRenderer", () => {
  let renderer: TestableMcpConfigRenderer;

  beforeEach(() => {
    renderer = new TestableMcpConfigRenderer();
  });

  describe("filterStdioServers", () => {
    it("should filter out stdio servers", () => {
      const servers: ApplyMcpServer[] = [
        { name: "server1", transport: "stdio", command: "node", args: [], sourceFile: "/test.ts" },
        { name: "server2", transport: "http", url: "http://localhost:3000", sourceFile: "/test.ts" } as ApplyMcpServer,
      ];

      const result = renderer.filterStdioServersPublic(servers);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("server1");
    });

    it("should return empty array when no stdio servers", () => {
      const servers: ApplyMcpServer[] = [
        { name: "server1", transport: "http", url: "http://localhost:3000", sourceFile: "/test.ts" } as ApplyMcpServer,
      ];

      const result = renderer.filterStdioServersPublic(servers);

      expect(result).toHaveLength(0);
    });

    it("should return all servers when all are stdio", () => {
      const servers: ApplyMcpServer[] = [
        { name: "server1", transport: "stdio", command: "node", args: [], sourceFile: "/test.ts" },
        { name: "server2", transport: "stdio", command: "python", args: [], sourceFile: "/test.ts" },
      ];

      const result = renderer.filterStdioServersPublic(servers);

      expect(result).toHaveLength(2);
    });

    it("should handle empty array", () => {
      const result = renderer.filterStdioServersPublic([]);

      expect(result).toHaveLength(0);
    });
  });

  describe("isObject", () => {
    it("should return true for plain objects", () => {
      expect(renderer.isObjectPublic({})).toBe(true);
      expect(renderer.isObjectPublic({ key: "value" })).toBe(true);
    });

    it("should return false for null", () => {
      expect(renderer.isObjectPublic(null)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(renderer.isObjectPublic("string")).toBe(false);
      expect(renderer.isObjectPublic(123)).toBe(false);
      expect(renderer.isObjectPublic(true)).toBe(false);
      expect(renderer.isObjectPublic(undefined)).toBe(false);
    });

    it("should return false for arrays", () => {
      expect(renderer.isObjectPublic([])).toBe(false);
      expect(renderer.isObjectPublic([1, 2, 3])).toBe(false);
      expect(renderer.isObjectPublic(["a", "b"])).toBe(false);
    });

    it("should return false for functions", () => {
      expect(renderer.isObjectPublic(() => {})).toBe(false);
    });
  });

  describe("renderConfig", () => {
    it("should be implemented by subclass", () => {
      const result = renderer.renderConfig({}, []);
      expect(result).toHaveProperty("filtered");
      expect(result).toHaveProperty("isObj");
    });
  });
});
