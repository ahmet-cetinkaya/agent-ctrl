import { describe, it, expect } from "bun:test";
import { ForgeCodeAgentRenderer } from "@/infrastructure/features/apply/adapters/ForgeCodeAgentRenderer";

describe("ForgeCodeAgentRenderer", () => {
  const renderer = new ForgeCodeAgentRenderer();

  describe("fileExtension", () => {
    it("should return .md extension", () => {
      expect(renderer.fileExtension).toBe(".md");
    });
  });

  describe("renderAgent", () => {
    it("should render agent without frontmatter", () => {
      const source = "Just a simple agent prompt";
      const result = renderer.renderAgent(source, "test-agent");

      expect(result).toContain("---");
      expect(result).toContain("id: test-agent");
      expect(result).toContain("title: Test Agent");
      expect(result).toContain("description:");
      expect(result).toContain("Just a simple agent prompt");
    });

    it("should render agent with existing frontmatter", () => {
      const source = `---
id: old-id
title: Old Title
description: Old description
---

Agent body here`;
      const result = renderer.renderAgent(source, "new-id");

      expect(result).toContain("---");
      expect(result).toContain("id: new-id");
      expect(result).toContain("title: New Id");
      expect(result).toContain("Agent body here");
    });

    it("should handle existing frontmatter and update properties", () => {
      const source = `---
title: Existing Title
---
Body content`;
      const result = renderer.renderAgent(source, "agent-id");

      expect(result).toContain("id: agent-id");
      expect(result).toContain("title: Agent Id"); // derive title from ID "agent-id"
      expect(result).toContain("description:");
      expect(result).toContain("Body content");
    });

    it("should handle malformed frontmatter (no opening ---)", () => {
      const source = `id: test
title: Test Agent
---
Body content`;
      const result = renderer.renderAgent(source, "test");

      expect(result.startsWith("---")).toBe(true);
      expect(result).toContain("id: test");
      expect(result).toContain("Body content");
    });

    it("should handle malformed frontmatter with closing --- but no opening", () => {
      const source = `key: value
---
body`;
      const result = renderer.renderAgent(source, "id");
      expect(result).toContain("---");
      expect(result).toContain("id: id");
      expect(result).toContain("body");
    });

    it("should handle frontmatter with no closing ---", () => {
      const source = `---
id: test
title: Test`;
      const result = renderer.renderAgent(source, "test");

      // Should recover and create proper frontmatter
      expect(result.startsWith("---")).toBe(true);
      expect(result).toContain("id: test");
    });

    it("should handle malformed frontmatter without closing --- following properties", () => {
      const source = `id: something
title: title`;
      const result = renderer.renderAgent(source, "id");
      expect(result).toContain("---");
      expect(result).toContain("id: id");
    });

    it("should handle empty source", () => {
      const result = renderer.renderAgent("", "empty");

      expect(result).toContain("---");
      expect(result).toContain("id: empty");
    });

    it("should update multiple existing properties in frontmatter", () => {
      const source = `---
id: old-id
title: Old Title
description: Old Desc
extra: prop
---
Body`;
      const result = renderer.renderAgent(source, "new-id");
      expect(result).toContain("id: new-id");
      expect(result).toContain("extra: prop");
    });
  });
});
