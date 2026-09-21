import type { ModelCapability, ModelCapabilityMatrixTable } from "./types";

/**
 * Format rules only — deliberately contains NO model IDs or version tables,
 * so new model releases never require a change here (spec SC-004).
 *
 * Researched 2026-09-21 from official platform docs:
 * - claude: model field on commands/agents/skills; accepts full IDs, aliases, inherit
 * - opencode: provider/model-id on commands and agents
 * - kilo: provider/model-id on agents; commands written as skills by agent-ctrl
 * - forgecode: commands only name+description; agents accept separate model+provider
 * - qwen: subagents accept inherit/fast/model-id (constrained) — override required
 * - codex: prompts have no frontmatter; agents are TOML with a model field
 * - cursor/gemini/windsurf/antigravity: no model support on agent-ctrl's write surfaces
 */
const passthrough = (support: "set" | "drop" = "set"): ModelCapability => ({
  support,
  transform: "passthrough",
  requiresOverride: false,
});

const drop = (): ModelCapability => passthrough("drop");

export const MODEL_CAPABILITY_MATRIX: ModelCapabilityMatrixTable = {
  claude: {
    command: { support: "set", transform: "prefix-strip", requiresOverride: false },
    agent: { support: "set", transform: "prefix-strip", requiresOverride: false },
    skill: { support: "set", transform: "passthrough", requiresOverride: false },
  },
  opencode: {
    command: passthrough(),
    agent: passthrough(),
    skill: drop(),
  },
  kilo: {
    // Kilo workflows support model, but agent-ctrl writes commands as skills today.
    command: drop(),
    agent: passthrough(),
    skill: drop(),
  },
  forgecode: {
    command: drop(),
    agent: { support: "set", transform: "split", requiresOverride: false },
    skill: drop(),
  },
  qwen: {
    command: drop(),
    // Constrained vocabulary (inherit|fast|model-id): canonical value is not
    // mapped — users must set an explicit `models.qwen` override.
    agent: { support: "set", transform: "passthrough", requiresOverride: true },
    skill: drop(),
  },
  codex: {
    command: drop(),
    agent: passthrough(),
    skill: drop(),
  },
  cursor: {
    command: drop(),
    agent: drop(),
    skill: drop(),
  },
  gemini: {
    command: drop(),
    agent: drop(),
    skill: drop(),
  },
  windsurf: {
    command: drop(),
    agent: drop(),
    skill: drop(),
  },
  antigravity: {
    // Agent vocab is constrained to inherit|flash|pro, but agent-ctrl does not
    // write antigravity agents yet; all current surfaces drop with a warning.
    command: drop(),
    agent: drop(),
    skill: drop(),
  },
};

export function getModelCapability(
  platform: keyof ModelCapabilityMatrixTable,
  artifactKind: keyof ModelCapabilityMatrixTable[keyof ModelCapabilityMatrixTable]
): ModelCapability {
  return MODEL_CAPABILITY_MATRIX[platform][artifactKind];
}
