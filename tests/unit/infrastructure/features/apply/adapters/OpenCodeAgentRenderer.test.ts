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
    it("should convert a flow-sequence tools array into a deny-first permission map", () => {
      const source = `---
name: architect
description: Software architecture specialist
tools: ["Read", "Grep", "Glob"]
model: high-models
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toMatch(/permission:\n {2}"\*": deny\n {2}read: allow\n {2}grep: allow\n {2}glob: allow\n/);
      expect(result).not.toContain("tools:");
      expect(result).toContain("Body content");
    });

    it("should convert a block-sequence tools array into a deny-first permission map", () => {
      const source = `---
name: architect
description: Architecture agent
tools:
  - Read
  - Grep
---

Body content`;
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain('"*": deny');
      expect(result).toContain("read: allow");
      expect(result).toContain("grep: allow");
      expect(result).not.toContain("tools:");
    });

    it("should map Claude tool names and MCP wildcards to OpenCode permission keys", () => {
      const source = `---
name: researcher
description: Research agent
tools: [Read, Edit, Write, MultiEdit, WebFetch, Task, mcp__context7__*, mcp__github__get_issue]
---

Body`;
      const result = renderer.renderAgent(source, "researcher");

      expect(result).toMatch(/"\*": deny\n/);
      expect(result).toContain("edit: allow");
      expect(result).toContain("webfetch: allow");
      expect(result).toContain("task: allow");
      expect(result).toContain("context7_*: allow");
      expect(result).toContain("github_get_issue: allow");
      expect(result).not.toMatch(/write:|multiedit:|mcp__/);
    });

    it("should map Bash(pattern) entries into one bash rule object", () => {
      const source = `---
name: runner
description: Runner
tools: [Read, "Bash(git status:*)", "Bash(ls)"]
---

Body`;
      const result = renderer.renderAgent(source, "runner");

      expect(result).toMatch(/bash:\n\s+"\*": deny\n\s+git status \*: allow\n\s+ls: allow/);
      expect(result).not.toContain("bash(");
    });

    it("should let a bare Bash allow every command even beside patterns", () => {
      const source = `---
name: runner
description: Runner
tools: ["Bash(git status:*)", Bash]
---

Body`;
      const result = renderer.renderAgent(source, "runner");

      expect(result).toContain("bash: allow");
    });

    it("should let an explicit permission map override the generated allowlist", () => {
      const source = `---
name: researcher
description: Research agent
tools: [Read, Bash]
permission:
  bash: ask
---

Body`;
      const result = renderer.renderAgent(source, "researcher");

      expect(result).toContain("bash: ask");
      expect(result).not.toContain("bash: allow");
      expect(result).toContain("read: allow");
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
      expect(result).toContain("read: allow");
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

      expect(result).toContain("read: allow");
      expect(result).toContain("bash: allow");
      expect(result).toContain("More content after a horizontal rule.");
    });

    it("should leave content unchanged when frontmatter YAML is malformed", () => {
      const source = `---
name: [unterminated
tools: ["Read"]
---

Body content`;

      expect(() => renderer.renderAgent(source, "architect")).not.toThrow();
      const result = renderer.renderAgent(source, "architect");
      expect(result).toContain("Body content");
    });

    it("should add frontmatter when none exists (no tools to normalize)", () => {
      const source = "# Architect Agent\n\nBe explicit.";
      const result = renderer.renderAgent(source, "architect");

      expect(result).toContain("id: architect");
      expect(result).toContain("Be explicit.");
    });
  });
});
