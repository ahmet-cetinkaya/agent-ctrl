# Feature Specification: Integrate Apply Per Platform

**Feature Branch**: `003-integrate-apply-platforms`  
**Created**: 2026-03-06  
**Status**: Draft  
**Input**: User description: "agent-ctrl should be configured to integrate the apply command across OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, and Windsurf platforms by applying configurations for each"

## Clarifications

### Session 2026-03-06

- Q: How should the system handle conflicting existing `apply` entries on a platform? → A: Replace conflicting existing `apply` entries with the required valid `apply` configuration automatically.
- Q: What should the command process per apply execution? → A: Single selected platform only.
- Q: What should happen if apply is run without a platform argument? → A: Fail with usage guidance and no changes.
- Q: How should command status treat an unchanged result? → A: Return success for unchanged outcomes.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Apply Apply To A Selected Platform (Priority: P1)

As a CLI operator, I can run the apply workflow for a selected platform (for example, `agent-ctrl apply opencode`) to configure the `apply` integration for that platform using its supported configuration model.

**Why this priority**: This is the core business value: one command reliably configures `apply` for the intended platform target.

**Independent Test**: Can be fully tested by running apply for one platform on a project without prior setup and verifying that exactly that platform receives a valid managed `apply` integration artifact.

**Acceptance Scenarios**:

1. **Given** a project with no existing `apply` integration for OpenCode, **When** the operator runs `agent-ctrl apply opencode`, **Then** the system applies `apply` configuration for OpenCode and reports OpenCode success.
2. **Given** a project where `apply` is already configured for OpenCode, **When** the operator runs `agent-ctrl apply opencode`, **Then** the system preserves valid existing settings and avoids duplicate entries.
3. **Given** a project where `apply` is not configured for Gemini, **When** the operator runs `agent-ctrl apply gemini`, **Then** the system applies `apply` configuration only for Gemini.
4. **Given** a project where `apply` is not configured for Qwen, **When** the operator runs `agent-ctrl apply qwen`, **Then** the system applies `apply` configuration only for Qwen.
5. **Given** a project where `apply` is not configured for Kilo, **When** the operator runs `agent-ctrl apply kilo`, **Then** the system applies `apply` configuration only for Kilo.
6. **Given** a project where `apply` is not configured for Antigravity, **When** the operator runs `agent-ctrl apply antigravity`, **Then** the system applies `apply` integration only for Antigravity using the documented Antigravity customization surface.
7. **Given** a project where `apply` is not configured for Codex, **When** the operator runs `agent-ctrl apply codex`, **Then** the system applies `apply` integration only for Codex using the documented Codex configuration/customization surface.
8. **Given** a project where `apply` is not configured for Cursor, **When** the operator runs `agent-ctrl apply cursor`, **Then** the system applies `apply` integration only for Cursor using documented Cursor rule/configuration surfaces.
9. **Given** a project where `apply` is not configured for Windsurf, **When** the operator runs `agent-ctrl apply windsurf`, **Then** the system applies `apply` integration only for Windsurf using documented Windsurf rule/workflow surfaces.

---

### User Story 2 - Get Clear Targeted Results (Priority: P2)

As a CLI operator, I can see whether the selected platform was configured successfully or failed, so I can take corrective action quickly.

**Why this priority**: Visibility is needed to trust and operationalize repeated per-platform apply runs.

**Independent Test**: Can be tested by running apply for one selected platform with both writable and non-writable conditions and confirming that output includes explicit status for the selected platform.

**Acceptance Scenarios**:

1. **Given** apply runs for a selected platform, **When** that platform cannot be updated, **Then** the system returns a failure result with an actionable reason for the selected platform.
2. **Given** apply runs for a selected platform and writes the required integration artifact, **When** execution completes, **Then** the system returns `success` for that selected platform.
3. **Given** apply runs for a selected platform that is already in the required valid state, **When** execution completes, **Then** the system returns `unchanged` for that selected platform and treats the command outcome as successful.

---

### User Story 3 - Safe Re-Apply Behavior (Priority: P3)

As a CLI operator, I can rerun the apply workflow without causing conflicting or duplicated configuration values.

**Why this priority**: Re-runnability reduces operational risk during repeated setup, CI runs, and environment refreshes.

**Independent Test**: Can be tested by running apply for the same selected platform multiple times and confirming that resulting configuration remains stable and equivalent after the first successful run.

**Acceptance Scenarios**:

1. **Given** a selected platform is already correctly configured, **When** the operator reruns apply for that same platform, **Then** the configuration output remains logically unchanged and the system reports unchanged status.

### Edge Cases

- A requested platform configuration location is missing or inaccessible.
- Existing configuration contains unrelated custom entries that must remain intact.
- Existing configuration contains malformed `apply` entries that require replacement to reach a valid desired state.
- A platform name is invalid or unsupported in the command input.
- The command is run without a platform argument.
- Platform-specific configuration sources differ in structure, but each supported platform still needs an equivalent valid `apply` integration outcome when targeted.
- A platform supports multiple command/config scopes (for example, user-level and project-level) and precedence must remain deterministic.
- A Codex project is not trusted, so project-scoped `.codex/config.toml` overrides are not loaded.
- Cursor project rules and user/global rules both exist; the selected integration must preserve deterministic precedence.
- Windsurf global and workspace rules both exist; the selected integration must preserve deterministic precedence.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide an apply operation that requires one selected platform target per execution.
- **FR-002**: System MUST support selected platform targets for OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, and Windsurf.
- **FR-003**: System MUST configure the `apply` integration only for the selected platform target during an execution.
- **FR-004**: System MUST validate whether the selected platform already contains the required `apply` configuration before writing changes.
- **FR-005**: System MUST create missing selected-platform configuration entries required for `apply` integration.
- **FR-006**: System MUST automatically replace invalid, outdated, or conflicting existing `apply` platform entries with the required valid state.
- **FR-007**: System MUST avoid duplicate `apply` entries when run repeatedly for the same selected platform.
- **FR-008**: System MUST preserve non-`apply` platform settings and unrelated user-defined configuration.
- **FR-009**: System MUST return an outcome that identifies success, unchanged, or failure status for the selected platform.
- **FR-010**: System MUST provide an actionable failure message when the selected platform cannot be configured.
- **FR-011**: System MUST reject unsupported platform inputs with a clear error message and no configuration changes.
- **FR-012**: System MUST support rerun behavior that converges selected-platform configuration to the same desired `apply` integration state.
- **FR-013**: System MUST fail with usage guidance and perform no configuration changes when no platform argument is provided.
- **FR-014**: System MUST map selected-platform `success` and `unchanged` outcomes to a successful command exit status, and map selected-platform `failure` to a non-zero command exit status.
- **FR-015**: System MUST use the selected platform’s documented customization surface for `apply` integration and MUST NOT rely on undocumented/private configuration mechanisms.
- **FR-016**: For platforms that support both user-level and project-level command scopes, system behavior MUST follow platform-defined precedence consistently on every run.
- **FR-017**: For Antigravity, Cursor, and Windsurf (where command-file customization is not the primary documented interface), system MUST represent `apply` integration through documented rule/workflow/skill-style customization surfaces.
- **FR-018**: For Codex, system MUST prefer documented Codex config/skills/agent-guidance surfaces for reusable behavior and MUST NOT use deprecated custom prompt mechanisms.
- **FR-019**: For Cursor, system MUST preserve compatibility across project, user, and team rule scopes when applying `apply` integration.
- **FR-020**: For Windsurf, system MUST preserve compatibility across workspace and global rule/workflow scopes when applying `apply` integration.

### Key Entities _(include if feature involves data)_

- **Platform Target**: A named integration destination (OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, Windsurf) with a resolvable configuration location and result state.
- **Apply Integration Artifact**: The required platform-native integration representation (for example command definition or rule/workflow artifact) that represents a valid `apply` setup for a platform.
- **Apply Result**: A selected-platform operation outcome containing status (success, unchanged, failure) and human-readable details.

### Assumptions

- All eight target platforms expose a documented customization surface that can represent equivalent `apply` integration behavior.
- Operators initiating the apply workflow have permission to modify applicable project configuration files.
- Existing platform configuration formats are supported by the current agent-ctrl platform integration scope.

### Dependencies

- Apply orchestration and adapter extension points are already available in the codebase, and platform adapters for OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, and Windsurf are delivered by this feature.
- Projects using this feature include or can create required platform configuration artifacts.
- Platform documentation for supported customization surfaces remains available and stable enough for deterministic mapping.

### Documentation Baseline

- Supported customization-surface references are baselined in `specs/003-integrate-apply-platforms/research.md` under "Cross-Platform Configuration Surface Analysis (2026-03-07)".
- If authoritative platform documentation changes before release, this specification and associated tasks MUST be refreshed to preserve documented-surface compliance.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In at least 95% of runs on valid projects, selected-platform apply completes within 5 seconds and reaches a successful outcome (`success` or `unchanged`) without manual file edits.
- **SC-002**: 100% of apply runs produce an explicit status result for the selected platform.
- **SC-003**: Re-running apply after a successful run for the same platform yields no duplicate `apply` entries.
- **SC-004**: When selected-platform configuration fails, operators can identify the reason from output and complete corrective action within 10 minutes in at least 90% of observed failure cases.

### Measurement Protocol

- **MP-001 (for SC-001)**: A valid project is defined as one where the selected platform’s documented configuration location is resolvable (existing or creatable) and writable by the operator.
- **MP-002 (for SC-001)**: SC-001 is measured over at least 320 total apply runs (minimum 40 per platform), including clean and preconfigured states, with per-run duration and outcome captured.
- **MP-003 (for SC-004)**: Observed failure cases are controlled runs that intentionally trigger actionable failures (for example invalid platform input, missing config path, and permission denial) and are logged with timestamped start/end of remediation.
- **MP-004 (for SC-004)**: Corrective action is complete only when a rerun for the same selected platform returns `success` or `unchanged` and no manual file edits are required outside documented remediation steps.
