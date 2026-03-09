import { describe, it, expect } from "bun:test";
import { createMissingApiKeyError } from "@/infrastructure/features/catalog/errors/CatalogErrors";

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
      expect(error.message).toBe("SkillsMP API key is missing. Configure SKILLSMP_API_KEY in .agent-ctrl/.env or pass --api-key.");
    });

    it("creates error for Smithery registry", () => {
      const error = createMissingApiKeyError("Smithery", "SMITHERY_API_KEY");
      expect(error.message).toBe("Smithery API key is missing. Configure SMITHERY_API_KEY in .agent-ctrl/.env or pass --api-key.");
    });

    it("throws error when registryName is empty", () => {
      expect(() => createMissingApiKeyError("", "API_KEY")).toThrow("registryName cannot be empty");
    });

    it("throws error when registryName is only whitespace", () => {
      expect(() => createMissingApiKeyError("   ", "API_KEY")).toThrow("registryName cannot be empty");
    });

    it("throws error when envVarName is empty", () => {
      expect(() => createMissingApiKeyError("Registry", "")).toThrow("envVarName must be a valid environment variable name");
    });

    it("throws error when envVarName is only whitespace", () => {
      expect(() => createMissingApiKeyError("Registry", "   ")).toThrow("envVarName must be a valid environment variable name");
    });

    it("throws error when envVarName contains lowercase letters", () => {
      expect(() => createMissingApiKeyError("Registry", "invalid_key")).toThrow("envVarName must be a valid environment variable name");
    });

    it("throws error when envVarName contains special characters", () => {
      expect(() => createMissingApiKeyError("Registry", "INVALID-KEY")).toThrow("envVarName must be a valid environment variable name");
    });

    it("throws error when envVarName starts with number", () => {
      expect(() => createMissingApiKeyError("Registry", "1INVALID")).toThrow("envVarName must be a valid environment variable name");
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
});
