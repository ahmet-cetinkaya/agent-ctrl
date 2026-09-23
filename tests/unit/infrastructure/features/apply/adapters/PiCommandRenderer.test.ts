import { describe, it, expect } from "bun:test";
import { PiCommandRenderer } from "@/infrastructure/features/apply/adapters/PiCommandRenderer";

describe("PiCommandRenderer", () => {
  const renderer = new PiCommandRenderer();

  describe("fileExtension", () => {
    it("should return .md extension", () => {
      expect(renderer.fileExtension).toBe(".md");
    });
  });

  describe("renderCommand", () => {
    it("should render command without frontmatter", () => {
      const source = "Just a simple command";
      const result = renderer.renderCommand(source, "ac/lint-fix");

      expect(result).toContain("---");
      expect(result).toContain("description:");
      expect(result).toContain("Just a simple command");
      expect(result).not.toContain("name:");
    });

    it("should render command with existing frontmatter and preserve description", () => {
      const source = `---
description: Old description
---

Command body here`;
      const result = renderer.renderCommand(source, "ac/test-command");

      expect(result).toContain("description: Old description");
      expect(result).toContain("Command body here");
    });

    it("should add a description property when frontmatter exists but has none", () => {
      const source = `---
argument-hint: [path]
---

Body`;
      const result = renderer.renderCommand(source, "ac/test-command");

      expect(result).toContain("argument-hint: [path]");
      expect(result).toContain("description:");
    });

    it("should recover a description from malformed frontmatter (missing opening ---)", () => {
      const source = `description: Fix all lint issues
argument-hint: [path]
---

Run the linter and fix issues.`;
      const result = renderer.renderCommand(source, "dev/fix-lint");

      // Precisely split the output into its frontmatter block and body — a weaker
      // `toContain` check on the whole string would pass even if the raw malformed
      // lines were dumped verbatim into the body instead of being recovered as
      // frontmatter (the original bug).
      const lines = result.split("\n");
      expect(lines[0]).toBe("---");
      const closingIndex = lines.indexOf("---", 1);
      expect(closingIndex).toBeGreaterThan(0);
      const frontmatter = lines.slice(1, closingIndex);
      const body = lines
        .slice(closingIndex + 1)
        .join("\n")
        .trim();

      // The user-authored description and argument-hint must be preserved as actual
      // frontmatter fields, not discarded in favor of an id-derived one, and must not
      // leak into the body as raw text.
      expect(frontmatter).toContain("description: Fix all lint issues");
      expect(frontmatter).toContain("argument-hint: [path]");
      expect(body).toBe("Run the linter and fix issues.");
    });

    it("should fall back to a derived description when frontmatter is fully malformed (no closing ---)", () => {
      const source = `description: Fix all lint issues
Run the linter and fix issues.`;
      const result = renderer.renderCommand(source, "dev/fix-lint");

      expect(result).toContain("---");
      expect(result).toContain("description:");
    });

    it("should handle empty source", () => {
      const result = renderer.renderCommand("", "ac/empty");

      expect(result).toContain("---");
      expect(result).toContain("description:");
    });
  });
});
