import { describe, it, expect, beforeEach } from "bun:test";
import { validatePathTraversal, validateMultiplePaths } from "@/core/filestore/validators.js";
import fs from "node:fs";
import path from "node:path";

describe("validators - Path Traversal Security", () => {
  describe("validatePathTraversal", () => {
    it("should accept safe file paths within project root", () => {
      const result = validatePathTraversal("settings/claude/config.json", "/project");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.resolvedPath).toContain("/project/settings/claude/config.json");
    });

    it("should reject paths with double-dot traversal components", () => {
      const result = validatePathTraversal("../etc/passwd", "/project");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Path traversal detected");
      expect(result.error).toContain("..");
    });

    it("should reject paths escaping project root", () => {
      const result = validatePathTraversal("/etc/passwd", "/project");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("escapes allowed root");
    });

    it("should normalize relative paths correctly", () => {
      const result = validatePathTraversal("./settings/claude.json", "/project");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should handle absolute paths within project root", () => {
      const result = validatePathTraversal("/project/settings/claude/config.json", "/project");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it("should reject complex traversal patterns", () => {
      const result = validatePathTraversal("settings/claude/../../etc/passwd", "/project");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Path traversal detected");
    });

    it("should handle edge case of root directory itself", () => {
      const result = validatePathTraversal("/", "/project");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("escapes allowed root");
    });

    it("should handle deeply nested paths within project", () => {
      const result = validatePathTraversal("settings/claude/rules/deeply/nested/config.json", "/project");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe("validateMultiplePaths", () => {
    it("should validate multiple paths and return results in order", () => {
      const paths = ["settings/claude/config.json", "../etc/passwd", "settings/gemini/rules.json"];
      const results = validateMultiplePaths(paths, "/project");

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });

    it("should handle all safe paths", () => {
      const paths = ["settings/claude/config.json", "settings/gemini/rules.json", "settings/cursor/keybindings.json"];
      const results = validateMultiplePaths(paths, "/project");

      expect(results.every((r) => r.isValid)).toBe(true);
      expect(results.every((r) => r.error === null)).toBe(true);
    });

    it("should handle all unsafe paths", () => {
      const paths = ["../etc/passwd", "../../bin/sh", "/etc/hosts"];
      const results = validateMultiplePaths(paths, "/project");

      expect(results.every((r) => !r.isValid)).toBe(true);
      expect(results.every((r) => r.error !== null)).toBe(true);
    });

    it("should preserve order of input paths", () => {
      const paths = ["safe.json", "../unsafe.json", "another-safe.json"];
      const results = validateMultiplePaths(paths, "/project");

      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
    });

    it("should handle empty path array", () => {
      const results = validateMultiplePaths([], "/project");
      expect(results).toHaveLength(0);
    });

    it("should handle mixed safe and unsafe paths", () => {
      const paths = [
        "settings/claude/config.json",
        "../../../etc/passwd",
        "settings/gemini/safe.json",
        "/etc/unsafe",
        "settings/cursor/also-safe.json",
      ];
      const results = validateMultiplePaths(paths, "/project");

      expect(results).toHaveLength(5);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(true);
      expect(results[3].isValid).toBe(false);
      expect(results[4].isValid).toBe(true);
    });
  });

  describe("security edge cases", () => {
    it("should reject encoded traversal attempts", () => {
      const result = validatePathTraversal("settings/claude/.%2e/etc/passwd", "/project");
      expect(result.isValid).toBe(false);
    });

    it("should handle backslash traversal (Windows compatibility)", () => {
      const result = validatePathTraversal("settings\\claude\\..\\..\\etc\\passwd", "/project");
      expect(result.isValid).toBe(false);
    });

    it("should reject mixed traversal patterns", () => {
      const result = validatePathTraversal("./settings/../etc/passwd", "/project");
      expect(result.isValid).toBe(false);
    });

    it("should handle unicode normalization attacks", () => {
      const result = validatePathTraversal("settings/claude/‌../etc/passwd", "/project");
      expect(result.isValid).toBe(false);
    });
  });
});
