import { describe, it, expect, beforeEach } from "bun:test";
import { GitCloneFetcher } from "@/infrastructure/features/catalog/clients/GitCloneFetcher";

describe("GitCloneFetcher", () => {
  let fetcher: GitCloneFetcher;

  beforeEach(() => {
    fetcher = new GitCloneFetcher(10000);
  });

  describe("parseFrontmatter", () => {
    it("extracts name and description from YAML frontmatter", () => {
      const markdown = `---
name: test-skill
description: A test skill for testing
---

# Test Skill

Content here.
`;
      const result = (fetcher as any).parseFrontmatter(markdown);
      expect(result.name).toBe("test-skill");
      expect(result.description).toBe("A test skill for testing");
    });

    it("returns empty object when no frontmatter", () => {
      const markdown = `# No Frontmatter

Just content.
`;
      const result = (fetcher as any).parseFrontmatter(markdown);
      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
    });
  });

  describe("extractIdFromUrl", () => {
    it("extracts owner/repo/path from valid URL", () => {
      const result = (fetcher as any).extractIdFromUrl("https://github.com/owner/repo", "skills/my-skill");
      expect(result).toBe("owner/repo/skills/my-skill");
    });

    it("handles invalid URL gracefully", () => {
      const result = (fetcher as any).extractIdFromUrl("not-a-url", "skills/my-skill");
      expect(result).toContain("not-a-url");
    });
  });

  describe("extractNameFromPath", () => {
    it("extracts last segment from path", () => {
      expect((fetcher as any).extractNameFromPath("skills/my-skill")).toBe("my-skill");
    });

    it("handles single segment path", () => {
      expect((fetcher as any).extractNameFromPath("skill")).toBe("skill");
    });

    it("handles empty path", () => {
      expect((fetcher as any).extractNameFromPath("")).toBe("unknown-skill");
    });
  });

  describe("escapeShell", () => {
    it("escapes single quotes in values", () => {
      expect((fetcher as any).escapeShell("test'value")).toBe("'test'\\''value'");
    });

    it("wraps normal values in single quotes", () => {
      expect((fetcher as any).escapeShell("normal-value")).toBe("'normal-value'");
    });
  });
});
