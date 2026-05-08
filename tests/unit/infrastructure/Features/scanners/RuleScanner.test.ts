import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { RuleScanner } from "@/infrastructure/features/rule/scanners/RuleScanner";
import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";
import { mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

describe("RuleScanner", () => {
  let scanner: RuleScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new RuleScanner();
    testDir = resolve(tmpdir(), `rule-scanner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe("scan", () => {
    it("should return empty result for empty directory", async () => {
      const result = await scanner.scan(testDir);

      expect(result.artifacts).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("should find .md files", async () => {
      await writeFile(resolve(testDir, "my-rule.md"), "# My Rule");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe("my-rule");
      expect(result.artifacts[0].filename).toBe("my-rule.md");
      expect(result.artifacts[0].type).toBe(ArtifactType.RULE);
    });

    it("should find .markdown files", async () => {
      await writeFile(resolve(testDir, "my-rule.markdown"), "# My Rule");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe("my-rule");
      expect(result.artifacts[0].filename).toBe("my-rule.markdown");
    });

    it("should find multiple rule files", async () => {
      await writeFile(resolve(testDir, "rule1.md"), "# Rule 1");
      await writeFile(resolve(testDir, "rule2.md"), "# Rule 2");
      await writeFile(resolve(testDir, "rule3.markdown"), "# Rule 3");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(3);
      expect(result.artifacts.map((a) => a.id).sort()).toEqual(["rule1", "rule2", "rule3"]);
    });

    it("should skip non-markdown files", async () => {
      await writeFile(resolve(testDir, "my-rule.md"), "# My Rule");
      await writeFile(resolve(testDir, "readme.txt"), "Read me");
      await writeFile(resolve(testDir, "config.json"), "{}");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0]).toContain("invalid extension");
      expect(result.warnings[1]).toContain("invalid extension");
    });

    it("should handle mixed case extensions", async () => {
      await writeFile(resolve(testDir, "agent1.MD"), "# Agent 1");
      await writeFile(resolve(testDir, "agent2.MarkDown"), "# Agent 2");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(2);
      const sortedFilenames = result.artifacts.map((a) => a.filename).sort();
      expect(sortedFilenames).toEqual(["agent1.MD", "agent2.MarkDown"]);
      const sortedIds = result.artifacts.map((a) => a.id).sort();
      expect(sortedIds).toEqual(["agent1", "agent2"]);
    });

    it("should skip unreadable files", async () => {
      await writeFile(resolve(testDir, "my-rule.md"), "# My Rule");
      await chmod(resolve(testDir, "my-rule.md"), 0o000);

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Could not read");
    });

    it("should extract id from filename", async () => {
      await writeFile(resolve(testDir, "my-custom-rule.md"), "# My Rule");

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].id).toBe("my-custom-rule");
    });

    it("should handle filenames with multiple dots", async () => {
      await writeFile(resolve(testDir, "my.rule.v2.md"), "# My Rule");

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].id).toBe("my.rule.v2");
      expect(result.artifacts[0].filename).toBe("my.rule.v2.md");
    });

    it("should return absolute paths", async () => {
      await writeFile(resolve(testDir, "my-rule.md"), "# My Rule");

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].path).toMatch(new RegExp(`^${testDir}`));
    });

    it("should handle scan errors gracefully", async () => {
      const result = await scanner.scan("/nonexistent/directory/path");

      expect(result.artifacts).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Failed to scan");
    });
  });
});
