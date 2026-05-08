import { describe, it, expect } from "bun:test";
import { OpenCodeCommandRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeCommandRenderer";

describe("OpenCodeCommandRenderer", () => {
  const renderer = new OpenCodeCommandRenderer();

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
      expect(result).toContain("name: ac:lint-fix");
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
description: Test command
---
Body content`;
      const result = renderer.renderCommand(source, "ac/test");

      expect(result).toContain("---");
      expect(result).toContain("name: ac:test");
      expect(result).toContain("Body content");
    });

    it("should handle frontmatter with no closing ---", () => {
      const source = `---
name: test
description: Test
Invalid content here`;
      const result = renderer.renderCommand(source, "ac/test");

      // Should recover and create proper frontmatter
      expect(result).toContain("---");
      expect(result).toContain("name: ac:test");
    });

    it("should preserve body content when adding frontmatter", () => {
      const source = "# Command Title\n\nThis is the command body.";
      const result = renderer.renderCommand(source, "ac/example");

      expect(result).toContain("name: ac:example");
      expect(result).toContain("This is the command body.");
      expect(result).toContain("description:");
    });

    it("should update name property when it exists in frontmatter", () => {
      const source = `---
name: old
extra: property
---

Body`;
      const result = renderer.renderCommand(source, "ac/new-name");

      expect(result).toContain("name: ac:new-name");
      expect(result).toContain("extra: property");
    });

    it("should add name property when frontmatter exists but has no name", () => {
      const source = `---
description: Only description
---

Body`;
      const result = renderer.renderCommand(source, "ac/test-command");

      expect(result).toContain("name: ac:test-command");
      expect(result).toContain("description: Only description");
    });

    it("should handle empty source", () => {
      const result = renderer.renderCommand("", "ac/empty");

      expect(result).toContain("---");
      expect(result).toContain("name: ac:empty");
    });

    it("should handle command with ID segments", () => {
      const result = renderer.renderCommand("Test", "org/category/command-name");

      expect(result).toContain("name: org:category:command-name");
      expect(result).toContain("description:");
    });

    it("should preserve multiple frontmatter properties", () => {
      const source = `---
name: old
description: Test
category: tools
tags: [lint, fix]
---

Body`;
      const result = renderer.renderCommand(source, "ac/update");

      expect(result).toContain("name: ac:update");
      expect(result).toContain("description: Test");
      expect(result).toContain("category: tools");
      expect(result).toContain("tags: [lint, fix]");
    });
  });
});
