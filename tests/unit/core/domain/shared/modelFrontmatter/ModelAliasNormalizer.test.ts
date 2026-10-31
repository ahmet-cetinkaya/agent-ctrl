import { describe, expect, it } from "bun:test";
import { modelAliasEnvName, normalizeModelAlias } from "@/core/domain/shared/modelFrontmatter";

const ENV = {
  AGENT_CTRL_OPENCODE_MODEL_SONNET: "omniroute/combo/claude-sonnet",
  AGENT_CTRL_OPENCODE_MODEL_OPUS: " omniroute/combo/claude-opus ",
};

describe("normalizeModelAlias", () => {
  it("builds the env variable name per platform and alias", () => {
    expect(modelAliasEnvName("opencode", "sonnet")).toBe("AGENT_CTRL_OPENCODE_MODEL_SONNET");
  });

  it("maps a configured alias to its route", () => {
    expect(normalizeModelAlias("sonnet", "opencode", ENV)).toEqual({ value: "omniroute/combo/claude-sonnet" });
    expect(normalizeModelAlias("Opus", "opencode", ENV)).toEqual({ value: "omniroute/combo/claude-opus" });
  });

  it("drops an unmapped alias with a warning naming the variable", () => {
    const result = normalizeModelAlias("haiku", "opencode", ENV);

    expect(result.value).toBeUndefined();
    expect(result.warning).toContain("AGENT_CTRL_OPENCODE_MODEL_HAIKU");
  });

  it("drops an alias whose variable is blank", () => {
    const result = normalizeModelAlias("sonnet", "opencode", { AGENT_CTRL_OPENCODE_MODEL_SONNET: "  " });

    expect(result.value).toBeUndefined();
  });

  it("passes explicit routes and other values through unchanged", () => {
    expect(normalizeModelAlias("anthropic/claude-sonnet-4", "opencode", ENV)).toEqual({
      value: "anthropic/claude-sonnet-4",
    });
    expect(normalizeModelAlias("omniroute/sonnet", "opencode", ENV)).toEqual({ value: "omniroute/sonnet" });
  });

  it("leaves aliases untouched on platforms that accept them", () => {
    expect(normalizeModelAlias("sonnet", "claude", {})).toEqual({ value: "sonnet" });
  });

  it("applies to kilo with its own variables", () => {
    const result = normalizeModelAlias("sonnet", "kilo", { AGENT_CTRL_KILO_MODEL_SONNET: "kilo/sonnet-route" });

    expect(result).toEqual({ value: "kilo/sonnet-route" });
  });
});
