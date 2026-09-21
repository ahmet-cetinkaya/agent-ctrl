import { describe, expect, it } from "bun:test";
import { resolveModelFrontmatter, type ModelFrontmatterInput } from "@/core/domain/shared/modelFrontmatter";

describe("ModelFrontmatterResolver", () => {
  describe("absent cases", () => {
    it("returns absent with zero warnings when no model fields present", () => {
      const result = resolveModelFrontmatter({
        platform: "claude",
        artifactKind: "command",
      });

      expect(result.action).toBe("absent");
      expect(result.value).toBeUndefined();
      expect(result.warnings).toEqual([]);
    });

    it("returns absent when models map exists but has no entry for target platform", () => {
      const result = resolveModelFrontmatter({
        models: {},
        platform: "claude",
        artifactKind: "command",
      });

      expect(result.action).toBe("absent");
      expect(result.warnings).toEqual([]);
    });
  });

  describe("precedence", () => {
    it("models.<platform> override beats canonical model", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { qwen: "fast" },
        platform: "qwen",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("fast");
    });

    it("override for another platform does not apply to target platform", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { qwen: "fast" },
        platform: "opencode",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("anthropic/claude-sonnet-4-5");
    });

    it("override value passes through without transformation", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { claude: "anthropic/claude-haiku-4-5" },
        platform: "claude",
        artifactKind: "command",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("anthropic/claude-haiku-4-5");
    });
  });

  describe("transformations", () => {
    it("claude command strips provider prefix", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        platform: "claude",
        artifactKind: "command",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("claude-sonnet-4-5");
      expect(result.provider).toBeUndefined();
    });

    it("claude keeps bare values unchanged (inherit, aliases)", () => {
      for (const bare of ["inherit", "sonnet", "opus", "haiku"]) {
        const result = resolveModelFrontmatter({
          model: bare,
          platform: "claude",
          artifactKind: "command",
        });

        expect(result.action).toBe("set");
        expect(result.value).toBe(bare);
      }
    });

    it("opencode passes provider/model-id through unchanged", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        platform: "opencode",
        artifactKind: "command",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("anthropic/claude-sonnet-4-5");
    });

    it("codex agents pass value through", () => {
      const result = resolveModelFrontmatter({
        model: "openai/gpt-5.2",
        platform: "codex",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("openai/gpt-5.2");
    });

    it("forgecode agents split into model + provider", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        platform: "forgecode",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("claude-sonnet-4-5");
      expect(result.provider).toBe("anthropic");
    });

    it("forgecode agents keep bare value without provider", () => {
      const result = resolveModelFrontmatter({
        model: "claude-sonnet-4-5",
        platform: "forgecode",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("claude-sonnet-4-5");
      expect(result.provider).toBeUndefined();
    });

    it("kilo agents pass value through", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        platform: "kilo",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("anthropic/claude-sonnet-4-5");
    });
  });

  describe("drop with warning", () => {
    const dropCases: Array<{ input: ModelFrontmatterInput; surface: string }> = [
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "gemini", artifactKind: "command" },
        surface: "Gemini",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "windsurf", artifactKind: "command" },
        surface: "Windsurf",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "cursor", artifactKind: "command" },
        surface: "Cursor",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "forgecode", artifactKind: "command" },
        surface: "Forge Code",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "opencode", artifactKind: "skill" },
        surface: "OpenCode",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "kilo", artifactKind: "skill" },
        surface: "Kilo Code",
      },
      {
        input: { model: "anthropic/claude-sonnet-4-5", platform: "antigravity", artifactKind: "skill" },
        surface: "Antigravity",
      },
      { input: { model: "anthropic/claude-sonnet-4-5", platform: "codex", artifactKind: "skill" }, surface: "Codex" },
    ];

    for (const { input, surface } of dropCases) {
      it(`drops model with warning for ${surface} ${input.artifactKind}`, () => {
        const result = resolveModelFrontmatter(input);

        expect(result.action).toBe("drop");
        expect(result.value).toBeUndefined();
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toContain(surface);
      });
    }

    it("override for a drop capability target is ignored with warning", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { windsurf: "sonnet" },
        platform: "windsurf",
        artifactKind: "command",
      });

      expect(result.action).toBe("drop");
      expect(result.value).toBeUndefined();
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("windsurf");
    });

    it("qwen agents require override: canonical model drops with override hint", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        platform: "qwen",
        artifactKind: "agent",
      });

      expect(result.action).toBe("drop");
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("models.qwen");
    });

    it("qwen agents accept explicit override value", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { qwen: "fast" },
        platform: "qwen",
        artifactKind: "agent",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("fast");
      expect(result.warnings).toEqual([]);
    });
  });

  describe("models map validation", () => {
    it("unknown platform key produces warning", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { zzz: "pro" },
        platform: "opencode",
        artifactKind: "command",
      });

      expect(result.action).toBe("set");
      expect(result.value).toBe("anthropic/claude-sonnet-4-5");
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain("zzz");
    });

    it("non-string override value for target platform produces warning and is ignored", () => {
      const result = resolveModelFrontmatter({
        model: "anthropic/claude-sonnet-4-5",
        models: { qwen: 42 },
        platform: "qwen",
        artifactKind: "agent",
      });

      expect(result.action).toBe("drop");
      expect(result.warnings.some((w) => w.includes("qwen"))).toBe(true);
    });

    it("non-string override value for target platform produces warning (no canonical model)", () => {
      const result = resolveModelFrontmatter({
        models: { opencode: ["a", "b"] },
        platform: "opencode",
        artifactKind: "command",
      });

      expect(result.action).toBe("absent");
      expect(result.warnings.some((w) => w.includes("opencode"))).toBe(true);
    });
  });

  describe("non-string canonical model", () => {
    it("non-string model value is ignored with warning", () => {
      const result = resolveModelFrontmatter({
        model: 42 as unknown as string,
        platform: "opencode",
        artifactKind: "command",
      });

      expect(result.action).toBe("drop");
      expect(result.warnings.length).toBe(1);
    });
  });
});
