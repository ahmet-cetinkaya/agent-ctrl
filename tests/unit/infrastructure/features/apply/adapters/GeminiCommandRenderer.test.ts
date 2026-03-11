import { describe, it, expect } from "bun:test";
import { GeminiCommandRenderer } from "@/infrastructure/features/apply/adapters/GeminiCommandRenderer";

describe("GeminiCommandRenderer", () => {
  const renderer = new GeminiCommandRenderer();

  describe("fileExtension", () => {
    it("should return .toml extension", () => {
      expect(renderer.fileExtension).toBe(".toml");
    });

    it("should be a readonly property", () => {
      expect(renderer.fileExtension).toBe(".toml");
    });
  });

  describe("renderCommand", () => {
    it("should render command as TOML format", () => {
      const source = "This is a command";
      const result = renderer.renderCommand(source, "test/command");

      expect(result).toContain("description = ");
      expect(result).toContain('prompt = """');
      expect(result).toContain('"""');
      expect(result).toContain("This is a command");
    });

    it("should escape triple quotes in body", () => {
      const source = 'Command with """triple quotes"""';
      const result = renderer.renderCommand(source, "ac/test");

      expect(result).toContain('\\"\\"\\"'); // Escaped triple quotes
    });

    it("should handle command with markdown title", () => {
      const source = "# Test Title\n\nCommand body here";
      const result = renderer.renderCommand(source, "ac/example");

      expect(result).toContain("description = ");
      expect(result).toContain("Command body here");
    });

    it("should handle empty source", () => {
      const result = renderer.renderCommand("", "ac/empty");

      expect(result).toContain("description = ");
      expect(result).toContain('prompt = """');
    });

    it("should preserve multi-line body", () => {
      const source = "Line 1\nLine 2\nLine 3";
      const result = renderer.renderCommand(source, "test/cmd");

      expect(result).toContain("Line 1");
      expect(result).toContain("Line 2");
      expect(result).toContain("Line 3");
    });

    it("should handle source with only newlines", () => {
      const source = "\n\n\n";
      const result = renderer.renderCommand(source, "ac/newlines");

      expect(result).toContain('prompt = """');
    });

    it("should handle complex markdown with multiple paragraphs", () => {
      const source = "# My Command\n\nFirst paragraph.\n\nSecond paragraph.\n\n- List item 1\n- List item 2";
      const result = renderer.renderCommand(source, "ac/complex");

      expect(result).toContain("First paragraph");
      expect(result).toContain("Second paragraph");
      expect(result).toContain("List item 1");
    });
  });
});
