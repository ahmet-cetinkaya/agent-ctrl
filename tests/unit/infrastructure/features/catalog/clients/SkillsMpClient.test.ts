import { describe, it, expect } from "bun:test";
import { SkillsMpClient } from "@/infrastructure/features/catalog/clients/SkillsMpClient";

describe("SkillsMpClient", () => {
  describe("error handling", () => {
    it("should handle timeout errors with custom message", async () => {
      const client = new SkillsMpClient({
        apiKey: "test-key",
        timeoutMs: 1,
      });

      const result = await client.search({ query: "test" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("timed out");
      }
    });

    it("should handle non-Error values", async () => {
      const mockFetch = async () => {
        throw "string error";
      };

      const client = new SkillsMpClient({
        apiKey: "test-key",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.search({ query: "test" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("string error");
      }
    });

    it("should handle Error objects other than AbortError", async () => {
      const mockFetch = async () => {
        throw new Error("Regular error");
      };

      const client = new SkillsMpClient({
        apiKey: "test-key",
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await client.search({ query: "test" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Regular error");
      }
    });
  });

  describe("API key resolution", () => {
    it("should use provided apiKey", () => {
      const client = new SkillsMpClient({
        apiKey: "provided-key",
      });

      expect(client).toBeDefined();
    });
  });
});
