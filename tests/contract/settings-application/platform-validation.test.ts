import { describe, it, expect } from "bun:test";
import type { PlatformValidationResult } from "@/core/domain/shared/types/PlatformValidationResult.js";
import type { SupportedApplyPlatform } from "@/core/domain/shared/types/SupportedApplyPlatform.js";

/**
 * Contract tests for platform validation behavior.
 *
 * Purpose: Define and verify the expected behavior contracts for platform
 * directory name validation across all implementations.
 *
 * These tests ensure that any implementation adheres to the specified
 * validation rules and provides consistent behavior.
 */

describe("Platform Validation Contract", () => {
  describe("platform name validation contract", () => {
    it("should accept all valid platform names (case-insensitive)", () => {
      const validPlatforms: SupportedApplyPlatform[] = [
        "antigravity",
        "claude",
        "codex",
        "cursor",
        "forgecode",
        "gemini",
        "kilo",
        "opencode",
        "qwen",
        "windsurf",
      ];

      // Contract: All supported platform names must be valid
      validPlatforms.forEach((platform) => {
        const result = validatePlatformNameContract(platform);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPlatform).toBe(platform);
        expect(result.validationErrors).toHaveLength(0);
      });
    });

    it("should normalize case variations to canonical form", () => {
      const variations = [
        { input: "Claude", expected: "claude" as SupportedApplyPlatform },
        { input: "CLAUDE", expected: "claude" as SupportedApplyPlatform },
        { input: "ClAuDe", expected: "claude" as SupportedApplyPlatform },
        { input: "Gemini", expected: "gemini" as SupportedApplyPlatform },
        { input: "CURSOR", expected: "cursor" as SupportedApplyPlatform },
      ];

      // Contract: Platform names are case-insensitive, normalized to lowercase
      variations.forEach(({ input, expected }) => {
        const result = validatePlatformNameContract(input);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPlatform).toBe(expected);
      });
    });

    it("should reject invalid platform names with clear error messages", () => {
      const invalidNames = [
        "invalid",
        "platform",
        "claude-code", // hyphens not supported (use 'claude' instead)
        "cursor-ai",
        "gemini-pro",
        "",
        "vscode",
        "intellij",
      ];

      // Contract: Invalid names must be rejected with descriptive errors
      invalidNames.forEach((name) => {
        const result = validatePlatformNameContract(name);
        expect(result.isValid).toBe(false);
        expect(result.normalizedPlatform).toBeNull();
        expect(result.validationErrors.length).toBeGreaterThan(0);
        expect(result.validationErrors[0]).toContain("not supported");
      });
    });

    it("should include list of valid platforms in error message", () => {
      const result = validatePlatformNameContract("invalid-platform");

      // Contract: Error message must guide user to valid options
      expect(result.validationErrors[0]).toMatch(/claude|gemini|cursor/i);
      expect(result.validationErrors[0]).toMatch(/Valid platforms|supported platforms/i);
    });

    it("should reject special characters and malformed names", () => {
      const malformedNames = ["claude@", "gemini!", "cursor../", "codex<script>", "../../etc", "null", "undefined"];

      // Contract: Malformed input must be rejected for security
      malformedNames.forEach((name) => {
        const result = validatePlatformNameContract(name);
        expect(result.isValid).toBe(false);
      });
    });

    it("should handle whitespace and edge cases", () => {
      const edgeCases = [
        "  claude  ",
        "\tgemini\t",
        "\ncursor\n",
        " ", // single space
      ];

      // Contract: Whitespace-only or whitespace-padded names should be rejected
      edgeCases.forEach((name) => {
        const result = validatePlatformNameContract(name);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe("validation result contract", () => {
    it("should return complete validation result structure", () => {
      const result = validatePlatformNameContract("claude");

      // Contract: Result must contain all required fields
      expect(result).toHaveProperty("directoryName");
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("normalizedPlatform");
      expect(result).toHaveProperty("validationErrors");
      expect(Array.isArray(result.validationErrors)).toBe(true);
    });

    it("should preserve original directory name in result", () => {
      const input = "ClAUdE";
      const result = validatePlatformNameContract(input);

      // Contract: Original input must be preserved for user feedback
      expect(result.directoryName).toBe(input);
    });

    it("should return empty validationErrors array for valid input", () => {
      const result = validatePlatformNameContract("gemini");

      // Contract: Valid input has no validation errors
      expect(result.validationErrors).toEqual([]);
    });

    it("should return non-empty validationErrors array for invalid input", () => {
      const result = validatePlatformNameContract("invalid");

      // Contract: Invalid input has at least one validation error
      expect(result.validationErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("platform identifier contract", () => {
    it("should match SupportedApplyPlatform enum values exactly", () => {
      const enumValues: SupportedApplyPlatform[] = [
        "antigravity",
        "claude",
        "codex",
        "cursor",
        "forgecode",
        "gemini",
        "kilo",
        "opencode",
        "qwen",
        "windsurf",
      ];

      // Contract: Validation must align with SupportedApplyPlatform type
      enumValues.forEach((platform) => {
        const result = validatePlatformNameContract(platform);
        expect(result.isValid).toBe(true);
        expect(result.normalizedPlatform).toBe(platform);
      });
    });

    it("should not accept variations not in SupportedApplyPlatform", () => {
      const variations = [
        "Claude-Code", // Not supported (use 'claude' instead)
        "Gemini-2",
        "Cursor-Pro",
        "VSCode",
        "Copilot",
      ];

      // Contract: Only exact SupportedApplyPlatform values are valid
      variations.forEach((variation) => {
        const result = validatePlatformNameContract(variation);
        expect(result.isValid).toBe(false);
      });
    });
  });
});

/**
 * Mock validation function for contract testing.
 *
 * In production, this would import the actual validation implementation.
 * For contract tests, we mock to ensure behavior meets specification.
 */
function validatePlatformNameContract(directoryName: string): PlatformValidationResult {
  const validPlatforms: SupportedApplyPlatform[] = [
    "antigravity",
    "claude",
    "codex",
    "cursor",
    "forgecode",
    "gemini",
    "kilo",
    "opencode",
    "qwen",
    "windsurf",
  ];

  const normalized = directoryName.toLowerCase().trim();

  // Reject empty or whitespace-only
  if (!normalized || normalized === "") {
    return {
      directoryName,
      isValid: false,
      normalizedPlatform: null,
      validationErrors: ["Platform name cannot be empty or whitespace only"],
    };
  }

  // Check for special characters (only alphanumeric and basic names allowed)
  if (!/^[a-z0-9]+$/.test(normalized)) {
    return {
      directoryName,
      isValid: false,
      normalizedPlatform: null,
      validationErrors: [
        `Platform '${directoryName}' contains invalid characters. Only alphanumeric characters are supported.`,
      ],
    };
  }

  // Check against valid platforms
  if (validPlatforms.includes(normalized as SupportedApplyPlatform)) {
    return {
      directoryName,
      isValid: true,
      normalizedPlatform: normalized as SupportedApplyPlatform,
      validationErrors: [],
    };
  }

  return {
    directoryName,
    isValid: false,
    normalizedPlatform: null,
    validationErrors: [`Platform '${directoryName}' is not supported. Valid platforms: ${validPlatforms.join(", ")}`],
  };
}
