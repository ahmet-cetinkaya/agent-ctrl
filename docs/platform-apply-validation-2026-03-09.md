# Platform Apply Validation Audit

Validated on 2026-03-09 against current public documentation discovered through EXA MCP.

## Scope

Reviewed the current `apply` implementation for:

- `claude`
- `codex`
- `cursor`
- `gemini`
- `opencode`
- `qwen`
- `kilo`
- `antigravity`
- `windsurf`

Primary code paths reviewed:

- `src/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver.ts`
- `src/infrastructure/features/apply/adapters/BaseTextAppyAdapter.ts`
- `src/infrastructure/features/claude/adapters/ClaudeApplyAdapter.ts`
- `src/infrastructure/features/claude/adapters/ClaudeAdapter.ts`
- `src/infrastructure/features/*/adapters/*Adapter.ts`

## Executive Summary

The current implementation is not platform-correct across most targets.

Two broad problems show up repeatedly:

1. User-scope writes are generally routed through `~/.agent-ctrl/...` via `CommandScopePrecedenceResolver`, but the validated platforms use their own homes such as `~/.claude`, `~/.codex`, `~/.gemini`, `~/.kilocode`, or product-managed UI storage.
2. Several adapters assume undocumented file formats or storage locations, especially for `qwen`, `antigravity`, `cursor` user scope, and `windsurf`.

Only `claude` is close to the documented model. Even there, the implementation still lags the current preferred customization pattern for skills.

## Cross-Platform Findings

### 1. User-scope path resolution is wrong for nearly every non-Claude adapter

Current behavior:

- `CommandScopePrecedenceResolver` defaults user scope to `process.env.AGENT_CTRL_HOME ?? ~/.agent-ctrl` and then appends platform-relative paths.
- See `src/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver.ts:18-26`.

Why this is incorrect:

- Gemini user commands are documented under `~/.gemini/commands/`.
- Codex global guidance is documented under `~/.codex/`.
- Kilo global workflows are documented under `~/.kilocode/workflows/`.
- OpenCode global configuration is documented under `~/.config/opencode`.
- Claude uses `~/.claude/`.
- Windsurf and Cursor global rules are managed at the product level, not under `~/.agent-ctrl/...`.

Required correction:

- Remove the generic `~/.agent-ctrl` fallback for platform apply targets.
- Each adapter must resolve its own documented user/global path.
- For platforms where the vendor does not document a file-based global path, do not guess one. Either:
  - support project/workspace scope only, or
  - mark user/global apply as unsupported until verified.

### 2. The current implementation treats every platform as “write one managed text file”

Current behavior:

- `BaseTextAppyAdapter` resolves one file, merges text, and writes it.
- See `src/infrastructure/features/apply/adapters/BaseTextAppyAdapter.ts:47-100`.

Why this is incorrect:

- Some platforms want commands, some want rules, some want workflows, some want `AGENTS.md`, and some prefer skills or extensions.
- A single “one file per platform” abstraction is only valid for a subset of the current targets.

Required correction:

- Split adapters by actual platform primitive:
  - command-file adapters
  - rule-file adapters
  - workflow-file adapters
  - guidance adapters (`AGENTS.md`)
  - extension/plugin adapters
- Reject unsupported combinations instead of silently generating plausible-looking files.

## Platform-by-Platform Findings

## Claude

Status: Partially aligned

What the code does now:

- Writes `CLAUDE.md` to either `.claude/CLAUDE.md` or `~/.claude/CLAUDE.md`.
- Syncs skills to `.claude/skills/`, agents to `.claude/agents/`, commands to `.claude/commands/`, and MCP servers into `.claude/settings.json`.
- See:
  - `src/infrastructure/features/claude/adapters/ClaudeApplyAdapter.ts:24-62`
  - `src/infrastructure/features/claude/adapters/ClaudeAdapter.ts:87-106`
  - `src/infrastructure/features/claude/adapters/ClaudeAdapter.ts:204-305`

Validated docs:

- Claude settings scopes use `~/.claude/` and `.claude/`.
- Claude custom commands have been folded into skills; `.claude/commands/*.md` still works, but skills are the preferred model.

Discrepancies:

- The implementation still treats commands and skills as separate first-class sync targets, while current Claude guidance prefers skills as the modern extensibility surface.
- The adapter writes MCP entries directly into `settings.json`, which is acceptable, but the broader implementation does not distinguish project/user/local/managed scope beyond project vs user.

Required correction:

- Keep `CLAUDE.md` and MCP support.
- Prefer syncing reusable project automation as `.claude/skills/<name>/SKILL.md` rather than relying on legacy `.claude/commands/`.
- If local scope is needed later, model `.claude/settings.local.json` explicitly instead of forcing only project/user behavior.

## Codex

Status: Misaligned

What the code does now:

- Legacy implementation wrote a single placeholder skill under the Codex skills directory for project scope.
- Legacy implementation wrote the same placeholder skill layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/codex/adapters/CodexAdapter.ts:7-33`.

Validated docs:

- Codex global guidance is loaded from `~/.codex/AGENTS.md` unless `CODEX_HOME` is set.
- Codex customization is centered on `AGENTS.md`, MCP, and skills.
- Codex user config lives in `~/.codex/config.toml`, with project overrides in `.codex/config.toml`.

Discrepancies:

- User scope is wrong: it targets `~/.agent-ctrl/codex/...` by default, not `~/.codex/...`.
- The implementation assumes `.codex/skills/...` is the canonical integration surface, but the verified docs emphasize `AGENTS.md` for persistent repo guidance and `~/.codex` for global guidance.
- The current adapter writes a skill whose content only tells Codex to run `agent-ctrl apply codex`; it does not actually encode durable project guidance.

Required correction:

- Reframe Codex apply around documented surfaces:
  - project guidance: `AGENTS.md` in the repo
  - global guidance: `~/.codex/AGENTS.md`
  - optional skill packaging only if a documented skill directory strategy is explicitly supported in the product workflow
- Remove the `AGENT_CTRL_CODEX_TRUSTED_PROJECT` heuristic and instead follow Codex’s actual trust/config model.

## Cursor

Status: Partially aligned for project scope, unsupported for user scope

What the code does now:

- Legacy implementation wrote a single placeholder rule file under `.cursor/rules/` for project scope.
- Legacy implementation wrote the same placeholder rule layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/cursor/adapters/CursorAdapter.ts:7-32`.

Validated docs:

- Project rules live in `.cursor/rules/`.
- Rule files can be `.md` or `.mdc`.
- Cursor documents project rules clearly, but current docs do not provide a stable filesystem path for user rules equivalent to the adapter’s `~/.agent-ctrl/cursor/rules/...`.

Discrepancies:

- Project rule path is correct.
- User scope path is not documented and should not be guessed.
- The generated rule is syntactically plausible, but it is only a wrapper telling Cursor to run `agent-ctrl apply cursor`; it does not apply actual project conventions or workflow logic.

Required correction:

- Keep project-scope writes to `.cursor/rules/`.
- Disable user-scope file writes unless a documented Cursor user-rule filesystem surface is verified.
- If this integration is meant to provide persistent workflow guidance, write a real rule description/content for Cursor instead of a self-referential command wrapper.

## Gemini

Status: Path model partly aligned, user scope and schema discipline misaligned

What the code does now:

- Legacy implementation wrote a single placeholder TOML command under `.gemini/commands/` for project scope.
- Legacy implementation wrote the same placeholder TOML layout under the resolver’s user root for user scope.
- Emits:
  - `name`
  - `description`
  - `prompt`
  - `scope`
  - `managed_by`
- See `src/infrastructure/features/gemini/adapters/GeminiAdapter.ts:7-25`.

Validated docs:

- Gemini custom commands live in:
  - project: `.gemini/commands/`
  - user: `~/.gemini/commands/`
- TOML command files require `prompt`; `description` is optional.

Discrepancies:

- User scope path is wrong.
- The adapter emits undocumented keys (`scope`, `managed_by`) without validation that Gemini CLI accepts or ignores them.
- Default scope precedence in shared resolver defaults Gemini to user scope, while Gemini’s documented precedence is project over user when both exist.

Required correction:

- Write user commands to `~/.gemini/commands/`.
- Emit only documented TOML keys unless a newer Gemini schema explicitly supports extras.
- Keep project scope available for repository-shared configuration, but allow user/global scope to be the default when that better matches the platform's documented home-directory model.

## OpenCode

Status: Project path close, content and user scope misaligned

What the code does now:

- Legacy implementation wrote a single placeholder markdown command under `.opencode/commands/` for project scope.
- Legacy implementation wrote the same placeholder markdown layout under the resolver’s user root for user scope.
- Emits plain markdown with no frontmatter.
- See `src/infrastructure/features/opencode/adapters/OpenCodeAdapter.ts:7-31`.

Validated docs:

- OpenCode custom commands are markdown files in a `commands/` directory.
- The documented project example is `.opencode/commands/test.md`.
- OpenCode’s global configuration home is `~/.config/opencode`.

Discrepancies:

- Project path is consistent with docs.
- User scope path is wrong.
- The generated markdown omits the documented frontmatter block (`description`, optional `agent`, optional `model`), so it does not follow the documented command format.

Required correction:

- Keep project command files in `.opencode/commands/`.
- Resolve user/global commands relative to `~/.config/opencode`, not `~/.agent-ctrl`.
- Emit documented frontmatter and command body, not a plain markdown heading.

## Qwen

Status: Misaligned

What the code does now:

- Legacy implementation wrote a single placeholder TOML command under `.qwen/commands/` for project scope.
- Legacy implementation wrote the same placeholder TOML layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/qwen/adapters/QwenAdapter.ts:7-25`.

Validated docs:

- Qwen Code documents settings via JSON files.
- Qwen Code documents extensions as the packaging surface for prompts, MCP servers, subagents, skills, and custom commands.
- Qwen also documents compatibility with Gemini and Claude extension ecosystems.

Discrepancies:

- The implementation assumes a Gemini-style `.toml` command file surface under `.qwen/commands/`, but the validated Qwen docs in this audit did not document that as the supported customization mechanism.
- User scope is also routed through the wrong home root.

Required correction:

- Do not generate raw `.qwen/commands/*.toml` files unless Qwen’s docs explicitly document that surface.
- Rework Qwen apply around the documented extension model.
- If Qwen intentionally supports Gemini-compatible command extensions, implement that as an extension/package flow rather than a guessed local TOML command path.

## Kilo

Status: Mostly aligned for project scope, misaligned for user scope and file shape

What the code does now:

- Legacy implementation wrote a single placeholder workflow under `.kilocode/workflows/` for project scope.
- Legacy implementation wrote the same placeholder workflow layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/kilo/adapters/KiloAdapter.ts:7-30`.

Validated docs:

- Kilo workflows are markdown files in:
  - project: `.kilocode/workflows/`
  - global: `~/.kilocode/workflows/`
- Workflows are invoked with `/[workflow-name.md]`.

Discrepancies:

- Project path is correct.
- User scope path is wrong.
- The generated content is only a short markdown note plus a shell block. The documented workflow model is a step-by-step executable workflow, not a generic prose file.

Required correction:

- Resolve user scope to `~/.kilocode/workflows/`.
- Generate actual numbered workflow steps that Kilo can execute meaningfully.
- Keep the `.md` filename because Kilo invokes workflows by markdown filename.

## Antigravity

Status: Misaligned

What the code does now:

- Legacy implementation wrote a single placeholder rule under `.antigravity/rules/` for project scope.
- Legacy implementation wrote the same placeholder rule layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/antigravity/adapters/AntigravityAdapter.ts:7-30`.

Validated docs:

- Global rules are in `~/.gemini/GEMINI.md`.
- Workspace rules are in `.agent/rules/`.
- Workflows are in `.agent/workflows/`.

Discrepancies:

- Both project and user paths are wrong.
- The adapter collapses rules, workflows, and skills into one guessed `.antigravity/rules/` file layout that does not match the documented `.agent/...` structure.

Required correction:

- Replace `.antigravity/rules/...` with documented Antigravity surfaces:
  - workspace rules: `.agent/rules/`
  - workflows: `.agent/workflows/`
  - global rules: `~/.gemini/GEMINI.md`
- Model rules and workflows as separate integration types instead of a single text adapter.

## Windsurf

Status: Misaligned

What the code does now:

- Legacy implementation wrote a single placeholder rule under `.windsurf/rules/` for project scope.
- Legacy implementation wrote the same placeholder rule layout under the resolver’s user root for user scope.
- See `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts:7-30`.

Validated docs:

- Windsurf supports Rules, Workflows, Skills, and `AGENTS.md`.
- Rules are managed as global/workspace/system rules through the product’s customization model.
- Workflows are documented as markdown files invoked by `/[workflow-name]`.
- Windsurf docs clearly acknowledge `.windsurf` for some internal product state, but the rules docs in this audit do not validate `.windsurf/rules/...` as the supported rule storage surface.

Discrepancies:

- The adapter writes to an undocumented `.windsurf/rules/` path.
- User scope is also undocumented and routed through the wrong home root.
- The generated content is not clearly a Windsurf workflow or documented rule object.

Required correction:

- Do not write `.windsurf/rules/...` until an official filesystem location for rules is verified.
- Prefer one of:
  - project `AGENTS.md` for repo-scoped guidance
  - documented workflow files if the workflow storage path is officially confirmed
  - product-managed rules via UI/API if file-backed rules are not documented

## Recommended Implementation Changes

1. Replace `CommandScopePrecedenceResolver` with per-platform scope/path resolvers.
2. Remove generic user-root writes under `~/.agent-ctrl` for platform apply.
3. Split apply adapters by platform primitive instead of forcing everything through `BaseTextAppyAdapter`.
4. Mark unsupported or unverified platform surfaces as unsupported in CLI output instead of silently writing guessed files.
5. Rework `codex`, `qwen`, `antigravity`, and `windsurf` first; these are the furthest from verified documentation.
6. Tighten `gemini`, `opencode`, and `kilo` next; these have a valid concept but incorrect user-scope handling and/or file shape.
7. Modernize `claude` last by preferring skills over legacy command sync while keeping the current file locations.

## Documentation Used

- Claude Code settings: https://code.claude.com/docs/en/settings
- Claude Code skills / slash commands: https://code.claude.com/docs/en/skills
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- Codex skills: https://developers.openai.com/codex/skills/
- Codex customization: https://developers.openai.com/codex/concepts/customization/
- Codex `AGENTS.md` guidance: https://developers.openai.com/codex/guides/agents-md
- Codex config reference: https://developers.openai.com/codex/config-reference/
- Cursor rules: https://cursor.com/docs/rules
- Cursor help for rules: https://cursor.com/help/customization/rules
- Gemini CLI custom commands: https://geminicli.com/docs/cli/custom-commands/
- OpenCode commands: https://anomalyco-opencode.mintlify.app/commands
- OpenCode agent/global location example: https://anomalyco-opencode.mintlify.app/cli/agent
- Qwen Code settings: https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/
- Qwen Code extensions: https://qwenlm.github.io/qwen-code-docs/en/developers/extensions/extension/
- Kilo workflows: https://kilo.ai/docs/customize/workflows
- Antigravity rules/workflows: https://antigravity.google/docs/rules-workflows
- Windsurf memories/rules: https://docs.windsurf.com/windsurf/cascade/memories
- Windsurf workflows: https://docs.windsurf.com/windsurf/cascade/workflows
