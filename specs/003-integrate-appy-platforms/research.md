# Research: Appy Platform Apply Integration

## Scope

Feature context: support `agent-ctrl apply <platform>` for `opencode`, `gemini`, `qwen`, `kilo`, `antigravity`, `codex`, `cursor`, and `windsurf`, with each execution applying `appy` integration to one selected platform only.

## Decision 1: Selected-Platform Processing Model

- Decision: Keep `apply` as a single-platform command (`apply <platform>`) and process exactly one target per run.
- Rationale: Aligns with clarified scope, reduces accidental cross-platform writes, and keeps failure semantics deterministic.
- Alternatives considered:
- Apply to all platforms in one run. Rejected due to clarified requirement and higher rollback complexity.
- Optional default platform when omitted. Rejected because missing platform must fail with usage guidance.

## Decision 2: Adapter Selection Strategy

- Decision: Use an explicit adapter registry keyed by canonical platform IDs: `opencode`, `gemini`, `qwen`, `kilo`, `antigravity`, `codex`, `cursor`, `windsurf`.
- Rationale: Keeps support list centralized, enables stable error messages, and simplifies extension/testing.
- Alternatives considered:
- Conditional `if/else` chain inside `ApplyCommand`. Rejected due to scaling and maintainability issues.
- Dynamic runtime discovery by filesystem scanning. Rejected because deterministic support/error messaging is required.

## Decision 3: OpenCode Appy Integration Contract

- Decision: OpenCode adapter writes or updates only the managed `appy` command configuration for OpenCode while preserving unrelated OpenCode settings.
- Rationale: Satisfies replace-conflict and preserve-unrelated requirements with idempotent reruns.
- Alternatives considered:
- Overwrite entire OpenCode configuration document. Rejected because it risks user-owned settings.
- Append-only updates. Rejected because stale/conflicting `appy` entries must be replaced.

## Decision 4: Gemini Appy Integration Contract

- Decision: Gemini adapter applies a single managed `appy` command entry in Gemini target config, replacing conflicting `appy` definitions and preserving non-`appy` entries.
- Rationale: Consistent behavior across platforms lowers operational ambiguity and test variance.
- Alternatives considered:
- Store multiple `appy` variants side-by-side. Rejected because duplicates violate idempotency and conflict rules.

## Decision 5: Qwen Appy Integration Contract

- Decision: Qwen adapter follows the same managed-entry contract: create missing `appy`, replace conflicting `appy`, preserve unrelated Qwen settings.
- Rationale: Keeps core behavior uniform while allowing adapter-specific storage shape.
- Alternatives considered:
- Platform-specific conflict semantics for Qwen only. Rejected because it would fragment CLI expectations.

## Decision 6: Kilo Appy Integration Contract

- Decision: Kilo adapter performs deterministic upsert for `appy` and reports `success`, `unchanged`, or `failure` for the selected platform.
- Rationale: Directly aligns with spec FR-009/FR-014 and measurable result reporting.
- Alternatives considered:
- Success only when changes occurred. Rejected because unchanged desired state must still be success.

## Decision 7: Antigravity Appy Integration Contract

- Decision: Antigravity adapter uses the same deterministic managed `appy` lifecycle as other targets, including replace-on-conflict behavior.
- Rationale: Shared lifecycle keeps acceptance tests reusable across all supported platforms.
- Alternatives considered:
- Defer Antigravity to later phase. Rejected because supported-platform scope is explicit in the spec.

## Decision 8: Result and Exit Semantics

- Decision: Return successful command status for `success` and `unchanged`, and fail only on actual configuration errors.
- Rationale: Enables safe idempotent reruns and consistent CI behavior.
- Alternatives considered:
- Distinct non-zero exit for unchanged. Rejected because desired state already satisfied should not fail pipelines.

## Decision 9: Testing Strategy for Multi-Adapter Apply

- Decision: Add unit tests for adapter resolution and per-platform unsupported/missing argument handling, plus integration tests for at least one success and one failure path per new platform.
- Rationale: Meets constitution test gates while controlling regression risk from adapter expansion.
- Alternatives considered:
- Integration-only coverage. Rejected because core routing and status semantics need fast deterministic unit checks.

## Decision 10: Codex Appy Integration Contract

- Decision: Codex adapter writes a managed `appy` integration artifact using documented Codex configuration/customization surfaces, including trusted project-scoped and user-scoped configuration behavior.
- Rationale: Codex provides explicit configuration layering and documented customization surfaces; using those avoids unstable or deprecated paths.
- Alternatives considered:
- Use deprecated custom prompt mechanism as the primary integration path. Rejected because deprecated mechanisms increase long-term maintenance risk.

## Needs Clarification Resolution

All technical-context unknowns and integration patterns are resolved for planning. No `NEEDS CLARIFICATION` markers remain.

## Documentation Registry Verification Notes (2026-03-06)

### OpenCode

- Verified documentation source index: `/websites/opencode_ai`
- Verified docs:
- https://opencode.ai/docs/commands
- https://opencode.ai/docs/config
- Confirmed pattern: custom commands can be defined in config (`command` object) or command files; command definitions include `template` and optional metadata (`description`, `agent`, `model`).
- Planning impact: OpenCode adapter should target managed command-definition insertion/update for `appy` in the platform-native command config shape.

### Gemini CLI

- Verified documentation source index: `/google-gemini/gemini-cli`
- Verified docs:
- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md
- https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/writing-extensions.md
- Confirmed pattern: custom commands are TOML files (for example under `~/.gemini/commands/`) with `description` and `prompt`; arguments are passed via `{{args}}`.
- Planning impact: Gemini adapter should manage a single `appy` TOML command definition and replace conflicting managed definitions.

### Qwen Code

- Verified documentation source index: `/qwenlm/qwen-code`
- Verified docs:
- https://github.com/qwenlm/qwen-code/blob/main/docs/cli/commands.md
- https://github.com/qwenlm/qwen-code/blob/main/docs/extensions/getting-started-extensions.md
- Confirmed pattern: custom commands are TOML files, discovered from command directories with namespacing by subdirectory.
- Planning impact: Qwen adapter should write/update a managed `appy` TOML command in user/project command scope with idempotent replacement.

### Kilo and Antigravity

### Kilo

- Verified documentation source index: `/kilo-org/kilo`
- Verified docs include:
- Kilo config schema examples showing `command` definitions and global config shape (`$schema`, `command`, `agent`, `mcp`, etc.)
- Kilo migration docs describing config file discovery under `~/.config/kilo/` with `config.json`, `opencode.json`, `opencode.jsonc`
- Confirmed pattern: Kilo supports command definitions in config and explicit config file locations suitable for managed `appy` entry updates.
- Planning impact: Kilo adapter can follow the same managed command upsert strategy as OpenCode with a Kilo-specific config path and schema.

### Antigravity

- Documentation sources resolved:
- `/websites/antigravity_google_get-started`
- `/websites/antigravity_google_home`
- `/llmstxt/raw_githubusercontent_sirius-red_llms_txt_refs_heads_main_google_antigravity_llms-full_txt`
- Confirmed from official documentation: product-level capabilities, editor/agent workflows, and general settings surfaces.
- Not confirmed from official documentation: explicit CLI command-definition file format for custom `appy` command integration.
- Planning impact: Antigravity implementation should remain behind a documentation-validation gate until an authoritative config/command contract is confirmed.

## Independent Internet Validation (2026-03-06)

### OpenCode

- Verified sources:
- https://opencode.ai/docs/commands/
- https://open-code.ai/docs/en/config
- Confirmed: custom commands can be defined via config (`command` object) or Markdown files in command directories (including project-local `.opencode/commands/`).
- Planning impact: OpenCode `appy` integration can be implemented as a managed command entry with deterministic upsert semantics.

### Gemini CLI

- Verified sources:
- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/custom-commands.md
- Confirmed: custom slash commands are TOML files under user and project command directories with precedence rules (project overrides user).
- Planning impact: Gemini `appy` integration should write a managed TOML command and replace conflicting managed definition.

### Qwen Code

- Verified sources:
- https://qwenlm.github.io/qwen-code-docs/en/users/features/commands/
- https://qwenlm.github.io/qwen-code-docs/en/users/extension/introduction/
- Confirmed: command model is slash-command based with documented command system and broader extension/settings surfaces.
- Remaining ambiguity: explicit official file-path schema for project/user custom command file authoring was not consistently available from direct indexed results.
- Planning impact: keep Qwen adapter behind a contract-validation checkpoint before finalizing exact command-file path assumptions.

### Kilo CLI

- Verified sources:
- https://kilo.ai/docs/customize
- https://kilo.ai/docs/zh-CN/cli
- https://kilo.ai/cli
- Confirmed: Kilo CLI docs and customization/config surfaces are available, and Kilo ecosystem documentation references OpenCode-style command/config capabilities.
- Planning impact: Kilo `appy` integration can follow managed command upsert strategy, with final schema/path validated against Kilo’s active CLI config docs during implementation.

### Antigravity

- Verified sources:
- https://antigravity.google/docs/settings
- https://antigravity.google/docs/agent-modes-settings
- https://antigravity.google/docs/rules-workflows
- https://antigravity.google/docs/skills
- Confirmed: Antigravity documents rules/workflows/skills and settings locations (including global and workspace rule/skill conventions).
- Remaining ambiguity: no explicit official “custom slash command file” contract was found analogous to OpenCode/Gemini/Qwen command docs.
- Planning impact: for Antigravity, model `appy` integration as managed rules/workflows-style configuration unless official command-definition docs are confirmed.

### Codex CLI

- Verified sources:
- https://developers.openai.com/codex/config-basic/
- https://developers.openai.com/codex/config-reference/
- https://developers.openai.com/codex/custom-prompts/
- https://developers.openai.com/codex/skills/
- Confirmed: Codex supports layered configuration (`~/.codex/config.toml` and project `.codex/config.toml` for trusted projects), and reusable capability surfaces through skills. Custom prompts/slash-prompt files are explicitly deprecated in favor of skills.
- Planning impact: Codex `appy` integration should use documented Codex config and skill-oriented customization surfaces, with deterministic precedence and trusted-project behavior.

### Cursor

- Verified sources:
- https://cursor.com/docs/context/rules
- https://cursor.com/help/customization/rules
- Confirmed: Cursor supports project rules in `.cursor/rules` and additional user/global rule scopes, with rule file structures documented for markdown-based instructions.
- Planning impact: Cursor `appy` integration should use documented Cursor rule/configuration surfaces with deterministic scope precedence and preserve unrelated rule content.

### Windsurf

- Verified sources:
- https://docs.windsurf.com/windsurf/cascade/memories
- https://docs.windsurf.com/windsurf/cascade/workflows
- https://docs.windsurf.com/windsurf/cascade/agents-md
- Confirmed: Windsurf supports workspace-level rules in `.windsurf/rules`, global rules, workflow markdown files, and `AGENTS.md` style guidance discovery.
- Planning impact: Windsurf `appy` integration should use documented Windsurf rule/workflow surfaces and maintain deterministic behavior across workspace/global scopes.

## Cross-Platform Configuration Surface Analysis (2026-03-07)

### OpenCode

- Agents: documented agent model with built-in and custom agents, including primary/subagent behavior and agent configuration surfaces.
- Commands: custom command definitions supported via config (`command`) and markdown files in project/global command directories.
- MCPs: first-class MCP server configuration under `mcp` in config, including enable/disable and local/remote server support.
- Rules: project and global `AGENTS.md` guidance model.
- Skills: first-class `SKILL.md` discovery across project/global skill directories, including compatibility directories.
- Sources:
- https://opencode.ai/docs/agents/
- https://opencode.ai/docs/commands/
- https://opencode.ai/docs/mcp-servers/
- https://opencode.ai/docs/rules/
- https://opencode.ai/docs/skills/

### Gemini CLI

- Agents: terminal agent model is documented; configuration focuses on CLI behavior, context hierarchy, and trusted-folder controls rather than user-defined agent profiles.
- Commands: custom commands documented as TOML files with user/project precedence and namespacing.
- MCPs: first-class MCP integration with `gemini mcp` management and configuration-driven server discovery.
- Rules: hierarchical `GEMINI.md` context files provide persistent instruction/rule behavior.
- Skills: no standalone first-class local skill directory was identified in primary Gemini CLI docs; reusable capability packaging is documented through extensions.
- Sources:
- https://google-gemini.github.io/gemini-cli/docs/cli/custom-commands.html
- https://google-gemini.github.io/gemini-cli/docs/tools/mcp-server.html
- https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html
- https://google-gemini.github.io/gemini-cli/docs/extensions/

### Qwen Code

- Agents: first-class subagent system with specialized task execution and configurable behavior.
- Commands: comprehensive command model (`/`, `@`, `!`) with runtime extension commands; custom commands available through extension packaging.
- MCPs: first-class MCP integration with CLI management (`qwen mcp ...`) and scoped settings (`user` and `project`).
- Rules: persistent context/rule behavior documented via `QWEN.md` and context-file settings.
- Skills: skills are documented as extension-packaged capabilities and are explicitly part of extension composition.
- Sources:
- https://qwenlm.github.io/qwen-code-docs/en/users/features/sub-agents/
- https://qwenlm.github.io/qwen-code-docs/en/users/features/commands/
- https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/
- https://qwenlm.github.io/qwen-code-docs/en/developers/tools/memory/
- https://qwenlm.github.io/qwen-code-docs/en/users/extension/introduction/

### Kilo

- Agents: agent behavior is mode-driven (for example `architect`, `ask`, `debug`, `code`) and available in IDE/CLI surfaces.
- Commands: slash command workflows and mode-switch commands are documented; workflow commands execute from markdown workflow files.
- MCPs: first-class MCP support with project-level `.kilocode/mcp.json` and global MCP settings file, with project-overrides-global precedence.
- Rules: first-class custom rules with project/global scopes and explicit rule-loading precedence.
- Skills: no dedicated first-class `SKILL.md` capability surface was identified in the current official Kilo documentation; customization is centered on rules, workflows, and modes.
- Sources:
- https://kilocode.ai/docs/basic-usage/using-modes
- https://kilocode.ai/docs/features/slash-commands/workflows
- https://kilocode.ai/docs/features/mcp/using-mcp-in-kilo-code

## Baseline Refresh Note (2026-03-07)

- Cross-platform customization-surface baseline remains aligned with this feature scope:
  OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, Windsurf.
- Contract and integration artifacts reference this baseline for documented-surface validation.
- https://kilocode.ai/docs/advanced-usage/custom-rules
- https://kilocode.ai/docs/advanced-usage/memory-bank

### Antigravity

- Agents: first-class agent model with agent manager, multi-agent workflows, and specialized subagent capabilities.
- Commands: workflow-style command execution is documented through customization/workflow surfaces; explicit standalone command-file schema remains less explicit than command-first CLIs.
- MCPs: first-class MCP integration via built-in store and install flows.
- Rules: first-class global/workspace rules (`~/.gemini/GEMINI.md`, `.agent/rules`), with activation controls.
- Skills: first-class skills via `SKILL.md` in workspace/global skill directories.
- Sources:
- https://antigravity.google/docs/agent
- https://antigravity.google/docs/rules-workflows
- https://antigravity.google/docs/mcp
- https://antigravity.google/docs/skills

### Codex CLI

- Agents: multi-agent workflows are documented, including specialized agent orchestration behavior.
- Commands: rich built-in slash command surface is documented; deprecated custom prompt commands remain documented for backward compatibility only.
- MCPs: first-class MCP server integration with `codex mcp` commands and config-based server definitions.
- Rules: first-class project/user rule guidance through `AGENTS.md` discovery and precedence model.
- Skills: first-class skill system with `SKILL.md`, discovery scopes, and explicit invocation (`/skills`, `$` mention).
- Sources:
- https://developers.openai.com/codex/multi-agent/
- https://developers.openai.com/codex/cli/slash-commands/
- https://developers.openai.com/codex/mcp/
- https://developers.openai.com/codex/guides/agents-md/
- https://developers.openai.com/codex/skills/
- https://developers.openai.com/codex/custom-prompts/

### Cursor

- Agents: first-class agent mode with subagents and multiple execution modes in editor/CLI.
- Commands: built-in slash command system plus custom commands in project command directories.
- MCPs: first-class MCP integration in CLI/editor workflows, including MCP slash-command management and `mcp.json`-based loading behavior.
- Rules: first-class rules system with project/user/team scopes and `AGENTS.md` compatibility.
- Skills: first-class skills in editor and CLI with `SKILL.md` and project/global skill directories.
- Sources:
- https://cursor.com/help/ai-features/agent
- https://cursor.com/docs/cli/reference/slash-commands
- https://cursor.com/docs/cli/using
- https://cursor.com/docs/context/rules
- https://cursor.com/help/customization/skills
- https://cursor.com/changelog/1-6

### Windsurf

- Agents: first-class Cascade agent workflows, including planning-agent behavior for long-horizon tasks.
- Commands: command-like reusable automation is provided through markdown workflows invoked via slash-style workflow calls.
- MCPs: first-class MCP integration with UI and raw `mcp_config.json` support, including transport and OAuth support.
- Rules: first-class rules with global and workspace scopes under the memories/rules system.
- Skills: first-class skills with workspace/global `SKILL.md` conventions.
- Sources:
- https://docs.windsurf.com/windsurf/cascade/workflows
- https://docs.windsurf.com/windsurf/cascade/mcp
- https://docs.windsurf.com/windsurf/cascade/memories
- https://docs.windsurf.com/windsurf/cascade/skills
- https://docs.windsurf.com/windsurf/cascade/agents-md
