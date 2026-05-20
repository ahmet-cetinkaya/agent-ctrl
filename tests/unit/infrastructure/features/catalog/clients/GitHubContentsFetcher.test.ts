import { describe, it, expect, beforeEach } from "bun:test";
import { GitHubContentsFetcher } from "@/infrastructure/features/catalog/clients/GitHubContentsFetcher";

describe("GitHubContentsFetcher", () => {
  let fetcher: GitHubContentsFetcher;

  beforeEach(() => {
    fetcher = new GitHubContentsFetcher(5000);
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

    it("handles quoted values in frontmatter", () => {
      const markdown = `---
name: "quoted-skill"
description: 'quoted description'
---

Content.
`;
      const result = (fetcher as any).parseFrontmatter(markdown);
      expect(result.name).toBe("quoted-skill");
      expect(result.description).toBe("quoted description");
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
});
