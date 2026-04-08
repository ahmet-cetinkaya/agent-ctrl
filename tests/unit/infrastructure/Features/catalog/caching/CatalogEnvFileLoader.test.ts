import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { CatalogEnvFileLoader } from "@/infrastructure/features/catalog/caching/CatalogEnvFileLoader";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

describe("CatalogEnvFileLoader", () => {
  let loader: CatalogEnvFileLoader;
  let tempDir: string;

  beforeEach(async () => {
    loader = new CatalogEnvFileLoader();
    tempDir = resolve("/tmp", `catalog-env-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("returns empty values when .env does not exist", async () => {
      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toBe(resolve(tempDir, ".env"));
        expect(result.data.values).toEqual({});
      }
    });

    it("returns error when file cannot be read due to permission", async () => {
      await writeFile(resolve(tempDir, ".env"), "KEY=value");
      await chmod(resolve(tempDir, ".env"), 0o000);

      const result = await loader.load(tempDir);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Failed to load catalog .env file");
      }
    });

    it("parses key-value pairs correctly", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY1=value1\nKEY2=value2\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values).toEqual({ KEY1: "value1", KEY2: "value2" });
      }
    });

    it("ignores comment lines", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "# This is a comment\nKEY=value\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values).toEqual({ KEY: "value" });
      }
    });

    it("ignores empty lines", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY=value\n\n\nKEY2=value2\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values).toEqual({ KEY: "value", KEY2: "value2" });
      }
    });

    it("skips lines without separator", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY=value\ninvalidline\nKEY2=value2\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values).toEqual({ KEY: "value", KEY2: "value2" });
      }
    });

    it("skips lines with empty key", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY=value\n=value\nKEY2=value2\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values).toEqual({ KEY: "value", KEY2: "value2" });
      }
    });
  });

  describe("unquote", () => {
    it("removes double quotes around values", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, 'KEY="quoted value"\n');

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values.KEY).toBe("quoted value");
      }
    });

    it("removes single quotes around values", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY='quoted value'\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values.KEY).toBe("quoted value");
      }
    });

    it("does not remove single quotes from single character values", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY='ab'\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values.KEY).toBe("ab");
      }
    });

    it("does not remove unmatched quotes", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, 'KEY="unmatched\nKEY2=value\n');

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values.KEY).toBe('"unmatched');
      }
    });

    it("keeps values without quotes as-is", async () => {
      const envPath = resolve(tempDir, ".env");
      await writeFile(envPath, "KEY=unquoted\n");

      const result = await loader.load(tempDir);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.values.KEY).toBe("unquoted");
      }
    });
  });
});

async function chmod(path: string, mode: number): Promise<void> {
  const { chmod } = await import("node:fs/promises");
  await chmod(path, mode);
}
