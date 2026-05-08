import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { ListRulesQuery } from "@/core/application/features/rule/queries/ListRulesQuery";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("ListRulesQuery", () => {
  let query: ListRulesQuery;
  let testDir: string;

  beforeEach(async () => {
    query = new ListRulesQuery();
    testDir = resolve(tmpdir(), `rules-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("should return empty list for empty directory", async () => {
    const result = await query.execute({ rulesPath: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.artifacts).toEqual([]);
    }
  });

  it("should find markdown rule files", async () => {
    await writeFile(resolve(testDir, "test-rule.md"), "# Test Rule");

    const result = await query.execute({ rulesPath: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.artifacts.length).toBe(1);
      expect(result.data.artifacts[0].id).toBe("test-rule");
    }
  });

  it("should skip non-markdown files", async () => {
    await writeFile(resolve(testDir, "test-rule.md"), "# Test Rule");
    await writeFile(resolve(testDir, "readme.txt"), "Read me");

    const result = await query.execute({ rulesPath: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.artifacts.length).toBe(1);
      expect(result.data.warnings.length).toBeGreaterThan(0);
    }
  });
});
