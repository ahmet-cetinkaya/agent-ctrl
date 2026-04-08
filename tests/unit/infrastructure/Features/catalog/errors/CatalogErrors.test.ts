import { describe, it, expect } from "bun:test";
import {
  createMissingApiKeyError,
  createSkillNotFoundError,
  createSkillAccessBlockedError,
  createSkillRepositoryNotAccessibleError,
} from "@/infrastructure/features/catalog/errors/CatalogErrors";

describe("CatalogErrors", () => {
  describe("createMissingApiKeyError", () => {
    it("creates error with registry name and environment variable", () => {
      const error = createMissingApiKeyError("Smithery", "SMITHERY_API_KEY");
      expect(error.message).toContain("Smithery API key is missing");
      expect(error.message).toContain("SMITHERY_API_KEY");
      expect(error.message).toContain(".agent-ctrl/.env");
      expect(error.message).toContain("--api-key");
    });

    it("provides actionable configuration guidance", () => {
      const error = createMissingApiKeyError("SkillsMP", "SKILLSMP_API_KEY");
      expect(error.message).toMatch(/Configure.*in.*or pass/);
    });

    it("creates error for SkillsMP registry", () => {
      const error = createMissingApiKeyError("SkillsMP", "SKILLSMP_API_KEY");
      expect(error.message).toBe(
        "SkillsMP API key is missing. Configure SKILLSMP_API_KEY in .agent-ctrl/.env or pass --api-key."
      );
    });

    it("creates error for Smithery registry", () => {
      const error = createMissingApiKeyError("Smithery", "SMITHERY_API_KEY");
      expect(error.message).toBe(
        "Smithery API key is missing. Configure SMITHERY_API_KEY in .agent-ctrl/.env or pass --api-key."
      );
    });

    it("throws error when registryName is empty", () => {
      expect(() => createMissingApiKeyError("", "API_KEY")).toThrow("registryName cannot be empty");
    });

    it("throws error when registryName is only whitespace", () => {
      expect(() => createMissingApiKeyError("   ", "API_KEY")).toThrow("registryName cannot be empty");
    });

    it("throws error when envVarName is empty", () => {
      expect(() => createMissingApiKeyError("Registry", "")).toThrow(
        "envVarName must be a valid environment variable name"
      );
    });

    it("throws error when envVarName is only whitespace", () => {
      expect(() => createMissingApiKeyError("Registry", "   ")).toThrow(
        "envVarName must be a valid environment variable name"
      );
    });

    it("throws error when envVarName contains lowercase letters", () => {
      expect(() => createMissingApiKeyError("Registry", "invalid_key")).toThrow(
        "envVarName must be a valid environment variable name"
      );
    });

    it("throws error when envVarName contains special characters", () => {
      expect(() => createMissingApiKeyError("Registry", "INVALID-KEY")).toThrow(
        "envVarName must be a valid environment variable name"
      );
    });

    it("throws error when envVarName starts with number", () => {
      expect(() => createMissingApiKeyError("Registry", "1INVALID")).toThrow(
        "envVarName must be a valid environment variable name"
      );
    });

    it("accepts valid environment variable names with underscores", () => {
      const error = createMissingApiKeyError("Registry", "VALID_ENV_VAR_NAME123");
      expect(error.message).toContain("VALID_ENV_VAR_NAME123");
    });

    it("accepts valid environment variable names with numbers", () => {
      const error = createMissingApiKeyError("Registry", "API_KEY_123");
      expect(error.message).toContain("API_KEY_123");
    });

    it("accepts single character environment variable names", () => {
      const error = createMissingApiKeyError("Registry", "A");
      expect(error.message).toContain("A");
    });

    it("accepts environment variable name starting with underscore", () => {
      const error = createMissingApiKeyError("Registry", "_PRIVATE_KEY");
      expect(error.message).toContain("_PRIVATE_KEY");
    });
  });

  describe("createSkillNotFoundError", () => {
    it("creates error with skill reference", () => {
      const error = createSkillNotFoundError("test-skill");
      expect(error.message).toContain('Skill "test-skill"');
      expect(error.message).toContain("could not be found");
      expect(error.message).toContain("agent-ctrl skill search");
    });

    it("includes cause information when provided", () => {
      const error = createSkillNotFoundError("test-skill", "HTTP 404");
      expect(error.message).toContain("Cause: HTTP 404");
    });

    it("does not include cause when not provided", () => {
      const error = createSkillNotFoundError("test-skill");
      expect(error.message).not.toContain("Cause:");
    });

    it("includes hint to search for alternative skills", () => {
      const error = createSkillNotFoundError("my-skill");
      expect(error.message).toContain("agent-ctrl skill search");
    });
  });

  describe("createSkillAccessBlockedError", () => {
    it("creates error with skill reference", () => {
      const error = createSkillAccessBlockedError("blocked-skill");
      expect(error.message).toContain("blocking requests");
      expect(error.message).toContain("blocked-skill");
      expect(error.message).toContain("service may be restricting access");
    });

    it("provides local search as fallback", () => {
      const error = createSkillAccessBlockedError("my-skill");
      expect(error.message).toContain("agent-ctrl skill search");
    });

    it("mentions service may be restricting access", () => {
      const error = createSkillAccessBlockedError("skill");
      expect(error.message).toContain("blocking requests");
      expect(error.message).toContain("restricting access");
    });
  });

  describe("createSkillRepositoryNotAccessibleError", () => {
    it("creates error with skill reference and repository URL", () => {
      const error = createSkillRepositoryNotAccessibleError("my-skill", "https://github.com/user/repo");
      expect(error.message).toContain("my-skill");
      expect(error.message).toContain("https://github.com/user/repo");
      expect(error.message).toContain("could not be accessed");
    });

    it("provides verification hint", () => {
      const error = createSkillRepositoryNotAccessibleError("skill", "https://github.com/org/repo");
      expect(error.message).toContain("Verify the repository exists");
      expect(error.message).toContain("publicly accessible");
    });

    it("suggests alternative skill search", () => {
      const error = createSkillRepositoryNotAccessibleError("skill", "https://github.com/org/repo");
      expect(error.message).toContain("agent-ctrl skill search");
    });
  });
});
