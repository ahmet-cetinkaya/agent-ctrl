# Research: Dynamic MCP Config Management

## Scope

Feature context: dynamically discover MCP JSON files in `MCPs/`, load `mcpServers` entries, resolve variables from `MCPs/.env`, validate structure, and report clear load outcomes.

## Decision 1: Discovery and Ordering

- Decision: Use `<agent-ctrl-config-dir>/MCPs` as the only source and process JSON files in deterministic lexical order.
- Rationale: Predictable behavior and simple operator mental model.
- Alternatives considered:
- Recursive discovery across project tree. Rejected due to ambiguity.
- Manual registration list. Rejected because dynamic discovery is required.

## Decision 2: Config Shape

- Decision: Require JSON with top-level `mcpServers`, with required per-server `command` and `args`.
- Rationale: Matches common MCP configuration style and user expectation.
- Alternatives considered:
- Custom config schema. Rejected because it increases friction and conversion overhead.

## Decision 3: `.env` Source and Interpolation

- Decision: Use only `MCPs/.env` as env source and resolve `${VAR}` placeholders in any JSON string field.
- Rationale: Clear single-source behavior and direct support for secret-safe configs.
- Alternatives considered:
- Per-file `.env` references. Rejected for added complexity.
- Process environment as primary source. Rejected because explicit file-based behavior is requested.

## Decision 4: Runtime Env Injection

- Decision: For each server entry, compose runtime `env` by combining values from `MCPs/.env` and server-level `env` (after interpolation), with server-level `env` taking precedence on key collisions.
- Rationale: Supports both global secrets and per-server overrides.
- Alternatives considered:
- Use only server-level `env`. Rejected because `.env` values must be passed in.
- Use only `.env` and ignore server-level `env`. Rejected because many MCP configs include explicit `env` keys.

## Decision 5: Validation and Partial Failure

- Decision: Validate file and server-entry level independently, skip invalid entries/files, and continue loading valid entries; treat duplicate `mcpServers` keys across files as conflict errors (reject impacted entries, no silent override).
- Rationale: One bad file must not block all MCP servers.
- Alternatives considered:
- Fail-fast globally. Rejected due to operational fragility.

## Decision 6: Logging and Security

- Decision: Emit per-file/per-entry statuses with sanitized errors; never print secret values.
- Rationale: Clear troubleshooting with secret safety.
- Alternatives considered:
- Aggregate-only logs. Rejected because operators need actionable file-level diagnostics.

## Decision 7: Apply Integration

- Decision: Integrate MCP loading into existing apply flow rather than introducing a separate command.
- Rationale: Lower user-facing complexity and reuse of existing orchestration.
- Alternatives considered:
- New `mcp apply` command. Rejected for initial scope.

## Needs Clarification Resolution

All planning clarifications for config shape, env source location, and interpolation behavior are resolved.
