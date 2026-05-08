import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test";
import { ListSkillsQuery } from "@/core/application/features/skill/queries/ListSkillsQuery";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { ArtifactType } from "@/core/domain/shared/value-objects/ArtifactType";
import { SkillScanner } from "@/infrastructure/features/skill/scanners/SkillScanner";

describe("ListSkillsQuery", () => {
  let query: ListSkillsQuery;
  let testDir: string;

  beforeEach(async () => {
    query = new ListSkillsQuery();
    testDir = resolve(tmpdir(), `skills-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe("execute", () => {
    it("should return empty list for empty directory", async () => {
      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings).toEqual([]);
      }
    });

    it("should find skill directories with SKILL.md", async () => {
      const skillDir = resolve(testDir, "my-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, "SKILL.md"), "# My Skill");

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe("my-skill");
        expect(result.data.artifacts[0].directoryName).toBe("my-skill");
        expect(result.data.artifacts[0].path).toBe(skillDir);
        expect(result.data.artifacts[0].type).toBe(ArtifactType.SKILL);
      }
    });

    it("should find multiple skill directories", async () => {
      const skill1Dir = resolve(testDir, "skill-1");
      const skill2Dir = resolve(testDir, "skill-2");

      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(resolve(skill1Dir, "SKILL.md"), "# Skill 1");
      await writeFile(resolve(skill2Dir, "SKILL.md"), "# Skill 2");

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(2);
        expect(result.data.artifacts.map((a) => a.id).sort()).toEqual(["skill-1", "skill-2"]);
      }
    });

    it("should skip directories without SKILL.md", async () => {
      const skillDir = resolve(testDir, "my-skill");
      await mkdir(skillDir, { recursive: true });

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]).toContain("missing SKILL.md");
      }
    });

    it("should skip non-directory entries", async () => {
      await writeFile(resolve(testDir, "readme.md"), "# Read me");

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
      }
    });

    it("should handle mixed directories (valid and invalid)", async () => {
      const validSkill = resolve(testDir, "valid-skill");
      const invalidSkill = resolve(testDir, "invalid-skill");

      await mkdir(validSkill, { recursive: true });
      await mkdir(invalidSkill, { recursive: true });
      await writeFile(resolve(validSkill, "SKILL.md"), "# Valid");

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe("valid-skill");
        expect(result.data.warnings.length).toBe(1);
      }
    });

    it("should return error on scan failure", async () => {
      const result = await query.execute({ skillsPath: "/nonexistent/directory/path" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]).toContain("Failed to scan");
      }
    });

    it("should return error when scanner throws unexpected error", async () => {
      const mockScanner = {
        scan: vi.fn().mockRejectedValue(new Error("Unexpected scanner failure")),
      } as unknown as SkillScanner;

      const queryWithMock = new ListSkillsQuery();
      Object.assign(queryWithMock, { scanner: mockScanner });

      const result = await queryWithMock.execute({ skillsPath: testDir });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Failed to scan skills directory");
        expect(result.error.message).toContain("Unexpected scanner failure");
      }
    });

    it("should include catalog state when available", async () => {
      const skillsPath = resolve(testDir, "skills");
      await mkdir(skillsPath, { recursive: true });
      const skillDir = resolve(skillsPath, "my-skill");
      await mkdir(skillDir, { recursive: true });
      await mkdir(resolve(testDir, ".catalog"), { recursive: true });
      await writeFile(resolve(skillDir, "SKILL.md"), "# My Skill");

      // Create a catalog state file
      const catalogState = {
        version: 1,
        registries: [],
        discoveryScopes: [],
        catalogItems: [
          {
            catalogKey: "skillsmp:my-skill",
            itemType: "skill",
            sourceItemId: "my-skill",
            registryId: "skillsmp",
            displayName: "My Skill",
            description: "Test skill",
            compatibilityState: "compatible",
            activationState: "active",
            availabilityState: "available",
            capabilities: [],
            categories: [],
            lastSeenAt: "2024-01-01T00:00:00Z",
          },
        ],
        managedIntegrations: [
          {
            catalogKey: "skillsmp:my-skill",
            itemType: "skill",
            managedId: "my-skill",
            localPath: "/local/path/my-skill",
            state: "installed",
            installedAt: "2024-01-01T00:00:00Z",
            lastOperationStatus: "success",
            sourceRef: "skillsmp:my-skill:1.0.0",
          },
        ],
        compatibilityAssessments: [],
        operationLogs: [],
      };
      await writeFile(resolve(testDir, ".catalog", "state.json"), JSON.stringify(catalogState));

      const result = await query.execute({ skillsPath });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.catalogState.managedById.get("my-skill")).toBeDefined();
        expect(result.data.catalogState.catalogById.get("my-skill")).toBeDefined();
        expect(result.data.catalogState.managedById.get("my-skill")?.managedId).toBe("my-skill");
        expect(result.data.catalogState.catalogById.get("my-skill")?.sourceItemId).toBe("my-skill");
      }
    });

    it("should handle catalog state load failure gracefully", async () => {
      const skillsPath = resolve(testDir, "skills");
      await mkdir(skillsPath, { recursive: true });
      const skillDir = resolve(skillsPath, "my-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, "SKILL.md"), "# My Skill");
      await mkdir(resolve(testDir, ".catalog"), { recursive: true });
      // Write invalid JSON to cause catalog load to fail
      await writeFile(resolve(testDir, ".catalog", "state.json"), "{invalid json}");

      const result = await query.execute({ skillsPath });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should return empty maps when catalog fails to load
        expect(result.data.catalogState.managedById.size).toBe(0);
        expect(result.data.catalogState.catalogById.size).toBe(0);
        expect(result.data.artifacts.length).toBe(1);
      }
    });
  });

  describe("execute with catalog state filtering", () => {
    it("should filter catalog state by itemType skill", async () => {
      const skillsPath = resolve(testDir, "skills");
      await mkdir(skillsPath, { recursive: true });
      await mkdir(resolve(testDir, ".catalog"), { recursive: true });
      await mkdir(resolve(skillsPath, "my-skill"), { recursive: true });
      await writeFile(resolve(skillsPath, "my-skill", "SKILL.md"), "# My Skill");

      const catalogState = {
        version: 1,
        registries: [],
        discoveryScopes: [],
        catalogItems: [
          {
            catalogKey: "skillsmp:my-skill",
            itemType: "skill",
            sourceItemId: "my-skill",
            registryId: "skillsmp",
            displayName: "My Skill",
            description: "Test skill",
            compatibilityState: "compatible",
            activationState: "active",
            availabilityState: "available",
            capabilities: [],
            categories: [],
            lastSeenAt: "2024-01-01T00:00:00Z",
          },
          {
            catalogKey: "smithery:some-mcp",
            itemType: "mcp", // Should be filtered out
            sourceItemId: "some-mcp",
            registryId: "smithery",
            displayName: "Some MCP",
            description: "Test MCP",
            compatibilityState: "compatible",
            activationState: "active",
            availabilityState: "available",
            capabilities: [],
            categories: [],
            lastSeenAt: "2024-01-01T00:00:00Z",
          },
        ],
        managedIntegrations: [
          {
            catalogKey: "skillsmp:my-skill",
            itemType: "skill",
            managedId: "my-skill",
            localPath: "/local/path/my-skill",
            state: "installed",
            installedAt: "2024-01-01T00:00:00Z",
            lastOperationStatus: "success",
            sourceRef: "skillsmp:my-skill:1.0.0",
          },
          {
            catalogKey: "smithery:some-mcp",
            itemType: "mcp", // Should be filtered out
            managedId: "some-mcp",
            localPath: "/local/path/some-mcp",
            state: "installed",
            installedAt: "2024-01-01T00:00:00Z",
            lastOperationStatus: "success",
            sourceRef: "smithery:some-mcp:1.0.0",
          },
        ],
        compatibilityAssessments: [],
        operationLogs: [],
      };
      await writeFile(resolve(testDir, ".catalog", "state.json"), JSON.stringify(catalogState));

      const result = await query.execute({ skillsPath });

      expect(result.success).toBe(true);
      if (result.success) {
        // Only skill items should be in the maps
        expect(result.data.catalogState.managedById.get("my-skill")).toBeDefined();
        expect(result.data.catalogState.catalogById.get("my-skill")).toBeDefined();
        expect(result.data.catalogState.managedById.get("some-mcp")).toBeUndefined();
        expect(result.data.catalogState.catalogById.get("some-mcp")).toBeUndefined();
      }
    });
  });
});
