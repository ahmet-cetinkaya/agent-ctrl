import { describe, it, expect } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { McpInterpolationScanner } from "@/infrastructure/features/mcp/interpolation/McpInterpolationScanner";
import { McpPlaceholderResolver } from "@/infrastructure/features/mcp/interpolation/McpPlaceholderResolver";
import { McpEnvFileLoader } from "@/infrastructure/features/mcp/loaders/McpEnvFileLoader";
import { McpServerEnvComposer } from "@/infrastructure/features/mcp/loaders/McpServerEnvComposer";
import { McpPlaceholderValidation } from "@/infrastructure/features/mcp/validators/McpPlaceholderValidation";

describe("Mcp interpolation and env", () => {
  it("scans placeholders in nested structures", () => {
    const scanner = new McpInterpolationScanner();
    const refs = scanner.scan({ a: "${ONE}", nested: ["x", "${TWO}"] });
    expect(refs.map((ref) => ref.variableName).sort()).toEqual(["ONE", "TWO"]);
  });

  it("resolves placeholders and composes env with server override", () => {
    const resolver = new McpPlaceholderResolver();
    const composer = new McpServerEnvComposer();

    const resolved = resolver.resolve({ token: "${API_TOKEN}" }, { API_TOKEN: "abc" }) as { token: string };
    expect(resolved.token).toBe("abc");

    const composed = composer.compose({ API_TOKEN: "base", SHARED: "base" }, { API_TOKEN: "server" });
    expect(composed.API_TOKEN).toBe("server");
    expect(composed.SHARED).toBe("base");
  });

  it("loads env files and validates unresolved variables", async () => {
    const dir = await mkdtemp(join(tmpdir(), "mcp-env-"));
    const envPath = join(dir, ".env");

    try {
      await writeFile(envPath, "API_TOKEN=token\nBROKEN_LINE\n");
      const loader = new McpEnvFileLoader();
      const loaded = await loader.load(envPath);
      expect(loaded.exists).toBe(true);
      expect(loaded.variables.API_TOKEN).toBe("token");
      expect(loaded.malformed).toBe(true);

      const validation = new McpPlaceholderValidation();
      const issues = validation.validate(
        [
          { token: "${API_TOKEN}", variableName: "API_TOKEN", jsonPath: "$.env.API_TOKEN" },
          { token: "${MISSING}", variableName: "MISSING", jsonPath: "$.env.MISSING" },
        ],
        loaded.variables,
        "/tmp/test.json",
        "test",
        true
      );
      expect(issues.some((issue) => issue.code === "ENV_VAR_UNRESOLVED")).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
