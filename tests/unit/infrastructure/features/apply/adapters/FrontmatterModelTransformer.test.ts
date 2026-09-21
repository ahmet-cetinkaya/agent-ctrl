import { describe, expect, it } from "bun:test";
import { applyModelFrontmatter } from "@/infrastructure/features/apply/adapters/FrontmatterModelTransformer";

describe("FrontmatterModelTransformer", () => {
  describe("passthrough cases", () => {
    it("returns source unchanged when no frontmatter present", () => {
      const source = "# Just a heading\n\nBody content.\n";

      const result = applyModelFrontmatter(source, "opencode", "command");

      expect(result.content).toBe(source);
      expect(result.warnings).toEqual([]);
    });

    it("returns source unchanged when frontmatter has no model fields", () => {
      const source = "---\ndescription: A command\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "claude", "command");

      expect(result.content).toBe(source);
      expect(result.warnings).toEqual([]);
    });

    it("returns source unchanged when frontmatter is malformed YAML", () => {
      const source = "---\nmodel: [unclosed\n  bad indent\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "claude", "command");

      expect(result.content).toBe(source);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("model");
    });
  });

  describe("set action", () => {
    it("writes stripped value for claude command", () => {
      const source = "---\ndescription: A command\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "claude", "command");

      expect(result.content).toContain("model: claude-sonnet-4-5");
      expect(result.content).not.toContain("anthropic/");
      expect(result.content).toContain("description: A command");
      expect(result.content).toContain("Body.");
      expect(result.warnings).toEqual([]);
    });

    it("writes value unchanged for opencode command", () => {
      const source = "---\ndescription: A command\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "opencode", "command");

      expect(result.content).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result.warnings).toEqual([]);
    });

    it("writes split fields for forgecode agent", () => {
      const source = "---\nid: my-agent\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "forgecode", "agent");

      expect(result.content).toContain("model: claude-sonnet-4-5");
      expect(result.content).toContain("provider: anthropic");
      expect(result.content).toContain("id: my-agent");
    });
  });

  describe("drop action", () => {
    it("removes model with warning for unsupported surface", () => {
      const source = "---\ndescription: A command\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "gemini", "command");

      expect(result.content).not.toContain("model:");
      expect(result.content).toContain("description: A command");
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("Gemini");
    });
  });

  describe("models map handling", () => {
    it("always removes the models key from output", () => {
      const source =
        "---\ndescription: A command\nmodel: anthropic/claude-sonnet-4-5\nmodels:\n  qwen: fast\n---\n\nBody.\n";

      for (const platform of ["claude", "opencode", "gemini", "qwen"] as const) {
        const result = applyModelFrontmatter(source, platform, "command");
        expect(result.content).not.toContain("models:");
        expect(result.content).not.toContain("qwen");
      }
    });

    it("applies override for target platform", () => {
      const source = "---\nmodel: anthropic/claude-sonnet-4-5\nmodels:\n  qwen: fast\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "qwen", "agent");

      expect(result.content).toContain("model: fast");
      expect(result.warnings).toEqual([]);
    });

    it("emits warning for unknown override platform key", () => {
      const source = "---\nmodel: anthropic/claude-sonnet-4-5\nmodels:\n  zzz: pro\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "opencode", "command");

      expect(result.content).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("zzz");
    });
  });

  describe("degenerate frontmatter", () => {
    it("removes frontmatter block entirely when it becomes empty after deletion", () => {
      const source = "---\nmodel: anthropic/claude-sonnet-4-5\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "gemini", "command");

      expect(result.content).not.toContain("---");
      expect(result.content.startsWith("Body.")).toBe(true);
      expect(result.warnings.length).toBe(1);
    });

    it("warns when split overwrites an existing different provider value", () => {
      const source = "---\nmodel: anthropic/claude-sonnet-4-5\nprovider: openai\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "forgecode", "agent");

      expect(result.content).toContain("provider: anthropic");
      expect(result.warnings.some((w) => w.includes("provider"))).toBe(true);
    });

    it("does not warn when split provider matches existing value", () => {
      const source = "---\nmodel: anthropic/claude-sonnet-4-5\nprovider: anthropic\n---\n\nBody.\n";

      const result = applyModelFrontmatter(source, "forgecode", "agent");

      expect(result.content).toContain("provider: anthropic");
      expect(result.warnings).toEqual([]);
    });
  });

  describe("preservation rules", () => {
    it("preserves unrelated frontmatter fields and body verbatim", () => {
      const source = [
        "---",
        "description: Complex command",
        "allowed-tools:",
        "  - Read",
        "  - Grep",
        "model: anthropic/claude-sonnet-4-5",
        "---",
        "",
        "## Instructions",
        "",
        "Do the thing.",
        "",
        "<system-reminder>stay</system-reminder>",
      ].join("\n");

      const result = applyModelFrontmatter(source, "opencode", "command");

      expect(result.content).toContain("description: Complex command");
      expect(result.content).toContain("  - Read");
      expect(result.content).toContain("  - Grep");
      expect(result.content).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result.content).toContain("## Instructions");
      expect(result.content).toContain("Do the thing.");
      expect(result.content).toContain("<system-reminder>stay</system-reminder>");
    });

    it("preserves body exactly when dropping model", () => {
      const body = "Line1\n\nLine2 with: colons\n";
      const source = `---\nmodel: anthropic/claude-sonnet-4-5\n---\n${body}`;

      const result = applyModelFrontmatter(source, "windsurf", "command");

      expect(result.content.endsWith(body)).toBe(true);
    });

    it("handles CRLF line endings", () => {
      const source = "---\r\nmodel: anthropic/claude-sonnet-4-5\r\n---\r\n\r\nBody.\r\n";

      const result = applyModelFrontmatter(source, "claude", "command");

      expect(result.content).toContain("model: claude-sonnet-4-5");
      expect(result.content).toContain("Body.");
    });
  });
});
