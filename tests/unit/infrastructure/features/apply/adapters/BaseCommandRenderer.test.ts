import { describe, it, expect, beforeEach } from "bun:test";
import { BaseCommandRenderer } from "@/infrastructure/features/apply/adapters/BaseCommandRenderer";

class TestableCommandRenderer extends BaseCommandRenderer {
  readonly fileExtension = ".test";

  renderCommand(source: string, _id: string): string {
    return source;
  }

  public parseMarkdownPrompt(source: string, id: string) {
    return super.parseMarkdownPrompt(source, id);
  }

  public humanizeSegment(value: string): string {
    return super.humanizeSegment(value);
  }

  public idToName(id: string): string {
    return super.idToName(id);
  }
}

describe("BaseCommandRenderer", () => {
  let renderer: TestableCommandRenderer;

  beforeEach(() => {
    renderer = new TestableCommandRenderer();
  });

  describe("fileExtension", () => {
    it("should be defined as abstract property", () => {
      expect(renderer.fileExtension).toBe(".test");
    });
  });

  describe("renderCommand", () => {
    it("should be implemented by subclass", () => {
      expect(renderer.renderCommand("test", "test/id")).toBe("test");
    });
  });

  describe("parseMarkdownPrompt", () => {
    it("should extract title from markdown heading", () => {
      const result = renderer.parseMarkdownPrompt("# My Command\n\nBody content", "ac/test");

      expect(result.title).toBe("My Command");
      expect(result.body).toBe("Body content");
    });

    it("should use humanized id when no markdown heading", () => {
      const result = renderer.parseMarkdownPrompt("Plain content", "ac/my-command");

      expect(result.title).toBe("Ac / My Command");
      expect(result.body).toBe("Plain content");
    });

    it("should clean description by removing command keywords", () => {
      const result = renderer.parseMarkdownPrompt("# Test Command\n\nContent here", "ac/test");

      expect(result.description).toBe("Test");
    });

    it("should handle description with multiple command keywords", () => {
      const result = renderer.parseMarkdownPrompt("# Agent Workflow Skill\n\nContent", "ac/test");

      expect(result.description).toBe("Ac / Test");
    });

    it("should handle empty source", () => {
      const result = renderer.parseMarkdownPrompt("", "ac/empty");

      expect(result.title).toBe("Ac / Empty");
      expect(result.body).toBe("");
    });

    it("should handle source with only whitespace", () => {
      const result = renderer.parseMarkdownPrompt("   \n\n   ", "ac/whitespace");

      expect(result.title).toBe("Ac / Whitespace");
    });

    it("should handle multiline body with heading", () => {
      const source = "# Title\n\nLine 1\nLine 2\nLine 3";
      const result = renderer.parseMarkdownPrompt(source, "ac/test");

      expect(result.title).toBe("Title");
      expect(result.body).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should preserve whitespace in body when no heading", () => {
      const source = "  Some content  ";
      const result = renderer.parseMarkdownPrompt(source, "ac/test");

      expect(result.body).toBe("Some content");
    });
  });

  describe("humanizeSegment", () => {
    it("should convert slash-separated segments to title case", () => {
      expect(renderer.humanizeSegment("ac/lint-fix")).toBe("Ac / Lint Fix");
    });

    it("should handle underscores in segments", () => {
      expect(renderer.humanizeSegment("ac/my_command")).toBe("Ac / My Command");
    });

    it("should handle dashes in segments", () => {
      expect(renderer.humanizeSegment("ac/my-command")).toBe("Ac / My Command");
    });

    it("should handle mixed separators", () => {
      expect(renderer.humanizeSegment("ac/my_command/test-case")).toBe("Ac / My Command / Test Case");
    });

    it("should handle single segment", () => {
      expect(renderer.humanizeSegment("test")).toBe("Test");
    });

    it("should handle empty segments", () => {
      expect(renderer.humanizeSegment("ac//test")).toBe("Ac /  / Test");
    });

    it("should handle segments with numbers", () => {
      expect(renderer.humanizeSegment("ac/test123")).toBe("Ac / Test123");
    });

    it("should handle all caps segments", () => {
      expect(renderer.humanizeSegment("AC/TEST")).toBe("AC / TEST");
    });
  });

  describe("idToName", () => {
    it("should replace slashes with colons", () => {
      expect(renderer.idToName("ac/lint-fix")).toBe("ac:lint-fix");
    });

    it("should handle single segment", () => {
      expect(renderer.idToName("test")).toBe("test");
    });

    it("should handle multiple slashes", () => {
      expect(renderer.idToName("ac/folder/file")).toBe("ac:folder:file");
    });

    it("should handle no slashes", () => {
      expect(renderer.idToName("test-command")).toBe("test-command");
    });
  });
});
