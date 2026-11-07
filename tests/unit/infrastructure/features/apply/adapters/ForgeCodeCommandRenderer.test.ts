import { describe, it, expect } from "bun:test";
import { ForgeCodeCommandRenderer } from "@/infrastructure/features/apply/adapters/ForgeCodeCommandRenderer";

describe("ForgeCodeCommandRenderer", () => {
  const renderer = new ForgeCodeCommandRenderer();

  describe("fileExtension", () => {
    it("should return .md extension", () => {
      expect(renderer.fileExtension).toBe(".md");
    });
  });

  describe("renderCommand", () => {
    it("should render command without frontmatter", () => {
      const source = "Just a simple command";
      const result = renderer.renderCommand(source, "ac/test-command");

      expect(result).toContain("---");
      expect(result).toContain("name: ac:test-command");
      expect(result).toContain("description:");
      expect(result).toContain("Just a simple command");
    });

    it("should render command with existing frontmatter", () => {
      const source = `---
name: old-name
description: Old description
---

Command body here`;
      const result = renderer.renderCommand(source, "ac/test-command");

      expect(result).toContain("---");
      expect(result).toContain("name: ac:test-command");
      expect(result).toContain("description: Old description");
      expect(result).toContain("Command body here");
    });

    it("should handle malformed frontmatter (no opening ---)", () => {
      const source = `name: test
---
Body content`;
      const result = renderer.renderCommand(source, "ac/test");

      expect(result.startsWith("---")).toBe(true);
      expect(result).toContain("name: ac:test");
      expect(result).toContain("Body content");
    });

    it("should handle malformed frontmatter with closing --- but no opening", () => {
      const source = `name: something
---
body`;
      const result = renderer.renderCommand(source, "ac/id");
      expect(result).toContain("---");
      expect(result).toContain("name: ac:id");
      expect(result).toContain("body");
    });

    it("should handle frontmatter with no closing ---", () => {
      const source = `---
name: test
description: Test`;
      const result = renderer.renderCommand(source, "ac/test");

      // Should recover and create proper frontmatter
      expect(result.startsWith("---")).toBe(true);
      expect(result).toContain("name: ac:test");
    });

    it("should handle malformed frontmatter without closing --- following properties", () => {
      const source = `name: something`;
      const result = renderer.renderCommand(source, "ac/id");
      expect(result).toContain("---");
      expect(result).toContain("name: ac:id");
    });

    it("should handle empty source", () => {
      const result = renderer.renderCommand("", "ac/empty");

      expect(result).toContain("---");
      expect(result).toContain("name: ac:empty");
    });

    it("should handle malformed frontmatter ending with properties", () => {
      const source = `name: prop\n---`; // actually this matches renderWithMalformedFrontmatter frontmatterEnd > 0
      const result = renderer.renderCommand(source, "ac/test");
      expect(result).toContain("---");
      expect(result).toContain("name: ac:test");
    });
  });
});
