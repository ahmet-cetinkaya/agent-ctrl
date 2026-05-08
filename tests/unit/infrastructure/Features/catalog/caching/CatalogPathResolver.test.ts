import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rm, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { CatalogPathResolver } from "@/infrastructure/features/catalog/caching/CatalogPathResolver";

describe("CatalogPathResolver", () => {
  let resolver: CatalogPathResolver;
  let testDir: string;

  beforeEach(async () => {
    resolver = new CatalogPathResolver();
    testDir = resolve(tmpdir(), `path-resolver-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
    delete process.env.AGENT_CTRL_HOME;
  });

  describe("resolveFromConfigRoot", () => {
    it("should resolve all paths relative to config root", () => {
      const result = resolver.resolveFromConfigRoot(testDir);

      expect(result.configRoot).toBe(testDir);
      expect(result.skillsDir).toBe(resolve(testDir, "skills"));
      expect(result.mcpsDir).toBe(resolve(testDir, "mcps"));
      expect(result.catalogDir).toBe(resolve(testDir, ".catalog"));
      expect(result.stateFile).toBe(resolve(testDir, ".catalog", "state.json"));
      expect(result.logFile).toBe(resolve(testDir, ".catalog", "operations.jsonl"));
    });

    it("should handle absolute paths", () => {
      const absolutePath = "/absolute/path/to/config";
      const result = resolver.resolveFromConfigRoot(absolutePath);

      expect(result.configRoot).toBe(absolutePath);
      expect(result.skillsDir).toBe(resolve(absolutePath, "skills"));
      expect(result.catalogDir).toBe(resolve(absolutePath, ".catalog"));
    });

    it("should handle relative paths", () => {
      const relativePath = "relative/path";
      const result = resolver.resolveFromConfigRoot(relativePath);

      expect(result.configRoot).toBe(relativePath);
      expect(result.skillsDir).toBe(resolve(relativePath, "skills"));
      expect(result.catalogDir).toBe(resolve(relativePath, ".catalog"));
    });
  });

  describe("resolveFromHomeBase", () => {
    it("should use home directory when no homeBase or env var provided", () => {
      const result = resolver.resolveFromHomeBase();

      expect(result.configRoot).toContain(".agent-ctrl");
      expect(result.skillsDir).toBeDefined();
      expect(result.mcpsDir).toBeDefined();
      expect(result.catalogDir).toBe(resolve(result.configRoot, ".catalog"));
      expect(result.stateFile).toBe(resolve(result.configRoot, ".catalog", "state.json"));
      expect(result.logFile).toBe(resolve(result.configRoot, ".catalog", "operations.jsonl"));
    });

    it("should use custom homeBase when provided", () => {
      const result = resolver.resolveFromHomeBase(testDir);

      expect(result.configRoot).toBe(resolve(testDir, ".agent-ctrl"));
      expect(result.skillsDir).toBe(resolve(testDir, ".agent-ctrl", "skills"));
      expect(result.mcpsDir).toBe(resolve(testDir, ".agent-ctrl", "mcps"));
      expect(result.catalogDir).toBe(resolve(testDir, ".agent-ctrl", ".catalog"));
      expect(result.stateFile).toBe(resolve(testDir, ".agent-ctrl", ".catalog", "state.json"));
      expect(result.logFile).toBe(resolve(testDir, ".agent-ctrl", ".catalog", "operations.jsonl"));
    });

    it("should prioritize homeBase over AGENT_CTRL_HOME env var", () => {
      process.env.AGENT_CTRL_HOME = "/env-var-path";
      const result = resolver.resolveFromHomeBase(testDir);

      expect(result.configRoot).toBe(resolve(testDir, ".agent-ctrl"));
    });

    it("should use AGENT_CTRL_HOME env var when homeBase not provided", () => {
      const customPath = "/custom/home/path";
      process.env.AGENT_CTRL_HOME = customPath;
      const result = resolver.resolveFromHomeBase();

      expect(result.configRoot).toBe(resolve(customPath, ".agent-ctrl"));
      expect(result.skillsDir).toBe(resolve(customPath, ".agent-ctrl", "skills"));
      expect(result.catalogDir).toBe(resolve(customPath, ".agent-ctrl", ".catalog"));
    });

    it("should handle empty string homeBase", () => {
      const result = resolver.resolveFromHomeBase("");

      expect(result.configRoot).toContain(".agent-ctrl");
      expect(result.skillsDir).toBeDefined();
    });
  });
});
