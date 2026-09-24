import { describe, it, expect } from "bun:test";
import { PiAgentRenderer } from "@/infrastructure/features/apply/adapters/PiAgentRenderer";

describe("PiAgentRenderer", () => {
  const renderer = new PiAgentRenderer();

  describe("fileExtension", () => {
    it("should return .md extension", () => {
      expect(renderer.fileExtension).toBe(".md");
    });
  });

  describe("renderAgent", () => {
    it("should add name/description frontmatter when none exists", () => {
      const source = "# Architect Agent\n\nBe explicit.";
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("name: architect");
      expect(result).toContain("Be explicit.");
    });

    it("should update name and preserve other frontmatter fields (tools, model)", () => {
      const source = `---
name: old-name
description: Old description
tools: [read, grep]
model: anthropic/claude-sonnet-4-5
---

Body content`;
      const result = renderer.renderAgent(source, "security-auditor");

      expect(result).toContain("name: security-auditor");
      expect(result).toContain("description: Old description");
      expect(result).toContain("tools: [read, grep]");
      expect(result).toContain("model: anthropic/claude-sonnet-4-5");
      expect(result).toContain("Body content");
    });

    it("should add a description when frontmatter exists but has none", () => {
      const source = `---
name: architect
---

Body`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("name: architect");
      expect(result).toContain("description:");
    });

    it("should recover name/description from malformed frontmatter (missing opening ---)", () => {
      const source = `name: reviewer
description: Reviews pull requests
tools: [read]
---

Review the diff carefully.`;
      const result = renderer.renderAgent(source, "code-reviewer");

      // Precisely split into frontmatter/body — a weaker `toContain` check on the whole
      // string would pass even if the raw malformed lines were dumped verbatim into the
      // body instead of being recovered as frontmatter.
      const lines = result.split("\n");
      expect(lines[0]).toBe("---");
      const closingIndex = lines.indexOf("---", 1);
      expect(closingIndex).toBeGreaterThan(0);
      const frontmatter = lines.slice(1, closingIndex);
      const body = lines
        .slice(closingIndex + 1)
        .join("\n")
        .trim();

      expect(frontmatter).toContain("name: code-reviewer");
      expect(frontmatter).toContain("description: Reviews pull requests");
      expect(frontmatter).toContain("tools: [read]");
      expect(body).toBe("Review the diff carefully.");
    });

    it("should not mistake a body starting with a 'key: value'-looking line followed by a horizontal rule for malformed frontmatter", () => {
      const source = `Time: about 10 minutes

Do the thing.

---

Notes.`;
      const result = renderer.renderAgent(source, "code-reviewer");

      const lines = result.split("\n");
      expect(lines[0]).toBe("---");
      const closingIndex = lines.indexOf("---", 1);
      const frontmatter = lines.slice(1, closingIndex);
      const body = lines
        .slice(closingIndex + 1)
        .join("\n")
        .trim();

      // Only the synthesized name/description in frontmatter; all prose stays in body.
      expect(frontmatter).toContain("name: code-reviewer");
      expect(frontmatter.some((l) => l.includes("Time:"))).toBe(false);
      expect(body).toContain("Time: about 10 minutes");
      expect(body).toContain("Do the thing.");
      expect(body).toContain("Notes.");
    });

    it("should fall back to a derived name/description when frontmatter is fully malformed (no closing ---)", () => {
      const source = `name: reviewer
Review the diff carefully.`;
      const result = renderer.renderAgent(source, "code-reviewer");

      expect(result).toContain("---");
      expect(result).toContain("name: code-reviewer");
    });

    it("should not treat a '---' horizontal rule in the body as a second frontmatter block", () => {
      const source = `---
name: architect
description: Architecture agent
---

## Section

Some content

---

More content after a horizontal rule.`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("More content after a horizontal rule.");
      // Only one name: line should exist (from frontmatter, not duplicated into body handling)
      expect(result.match(/^name:/gm)?.length).toBe(1);
    });
  });
});
