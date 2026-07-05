import { describe, it, expect } from "bun:test";
import { validatePlatformName } from "@/config/validator.js";
import { SUPPORTED_APPLY_PLATFORMS } from "@/core/domain/shared/types/SupportedApplyPlatform";

describe("validatePlatformName", () => {
  describe("valid platform names", () => {
    it("should accept all supported platforms", () => {
      for (const platform of SUPPORTED_APPLY_PLATFORMS) {
        const result = validatePlatformName(platform);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPlatform).toBe(platform);
        expect(result.validationErrors).toHaveLength(0);
      }
    });

    it("should normalize uppercase to lowercase", () => {
      const result = validatePlatformName("CLAUDE");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPlatform).toBe("claude");
    });

    it("should normalize mixed case", () => {
      const result = validatePlatformName("GeMiNi");
      expect(result.isValid).toBe(true);
      expect(result.normalizedPlatform).toBe("gemini");
    });

    it("should preserve original directory name", () => {
      const result = validatePlatformName("Claude");
      expect(result.directoryName).toBe("Claude");
    });
  });

  describe("empty and whitespace names", () => {
    it("should reject empty string", () => {
      const result = validatePlatformName("");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPlatform).toBeNull();
      expect(result.validationErrors[0]).toContain("empty");
    });

    it("should reject whitespace-only string", () => {
      const result = validatePlatformName("   ");
      expect(result.isValid).toBe(false);
      expect(result.validationErrors[0]).toContain("empty");
    });

    it("should reject leading whitespace", () => {
      const result = validatePlatformName("  claude");
      expect(result.isValid).toBe(false);
      expect(result.validationErrors[0]).toContain("whitespace");
    });

    it("should reject trailing whitespace", () => {
      const result = validatePlatformName("claude  ");
      expect(result.isValid).toBe(false);
      expect(result.validationErrors[0]).toContain("whitespace");
    });

    it("should reject tab characters", () => {
      const result = validatePlatformName("\tgemini\t");
      expect(result.isValid).toBe(false);
    });
  });

  describe("invalid characters", () => {
    it("should reject special characters", () => {
      const result = validatePlatformName("claude@");
      expect(result.isValid).toBe(false);
      expect(result.validationErrors[0]).toContain("invalid characters");
    });

    it("should reject path traversal attempts", () => {
      const result = validatePlatformName("../etc");
      expect(result.isValid).toBe(false);
    });

    it("should reject hyphens", () => {
      const result = validatePlatformName("claude-code");
      expect(result.isValid).toBe(false);
      expect(result.validationErrors[0]).toContain("invalid characters");
    });
  });

  describe("unsupported but valid-format names", () => {
    it("should reject unknown alphanumeric platform", () => {
      const result = validatePlatformName("vscode");
      expect(result.isValid).toBe(false);
      expect(result.normalizedPlatform).toBeNull();
      expect(result.validationErrors[0]).toContain("not supported");
    });

    it("should list valid platforms in error message", () => {
      const result = validatePlatformName("unknown");
      expect(result.validationErrors[0]).toContain("claude");
    });
  });
});
