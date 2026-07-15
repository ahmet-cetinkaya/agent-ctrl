import { describe, it, expect } from "bun:test";
import { OpenCodeAgentRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeAgentRenderer";

describe("OpenCodeAgentRenderer", () => {
  const renderer = new OpenCodeAgentRenderer();

  describe("fileExtension", () => {
    it("should return .md extension", () => {
      expect(renderer.fileExtension).toBe(".md");
    });
  });

  describe("renderAgent", () => {
    it("should convert a flow-sequence tools array into a lowercase boolean map", () => {
      const source = `---
name: architect
description: Software architecture specialist
tools: ["Read", "Grep", "Glob"]
model: high-models
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("tools:");
      expect(result).toContain("read: true");
      expect(result).toContain("grep: true");
      expect(result).toContain("glob: true");
      expect(result).not.toContain('tools: ["Read"');
      expect(result).toContain("Body content");
    });

    it("should convert a block-sequence tools array into a lowercase boolean map", () => {
      const source = `---
name: architect
description: Architecture agent
tools:
  - Read
  - Grep
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("read: true");
      expect(result).toContain("grep: true");
      expect(result).not.toMatch(/tools:\s*\n\s*- Read/);
    });

    it("should leave an already-object tools field unchanged", () => {
      const source = `---
name: architect
description: Architecture agent
tools:
  read: true
  grep: false
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("read: true");
      expect(result).toContain("grep: false");
    });

    it("should leave frontmatter without a tools field unchanged", () => {
      const source = `---
name: architect
description: Architecture agent
model: high-models
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).not.toContain("tools:");
      expect(result).toContain("model: high-models");
      expect(result).toContain("Body content");
    });

    it("should still delegate id/title/description updates to the base ForgeCode rendering", () => {
      const source = `---
id: old-id
title: Old Title
description: Old description
tools: ["Read"]
---

Body content`;
      const result = renderer.renderAgent(source, "security-auditor");

      expect(result).toContain("id: security-auditor");
      expect(result).toContain("read: true");
    });

    it("should not treat a '---' horizontal rule in the body as a second frontmatter block", () => {
      const source = `---
name: architect
description: Architecture agent
tools: ["Read", "Bash"]
---

## Section

Some content

---

More content after a horizontal rule.`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("read: true");
      expect(result).toContain("bash: true");
      expect(result).toContain("More content after a horizontal rule.");
    });

    it("should add frontmatter when none exists (no tools to normalize)", () => {
      const source = "# Architect Agent\n\nBe explicit.";
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("id: architect");
      expect(result).toContain("Be explicit.");
    });
  });
});
