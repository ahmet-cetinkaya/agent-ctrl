# Feature Specification: Apply Project Profiles

**Feature Branch**: `[005-apply-profiles]`  
**Created**: 2026-05-18  
**Status**: Draft  
**Input**: User description: Thoroughly analyze the requirements specified in `@docs/PRD.md`. Implement a new `apply` method within the CLI designed to apply project-specific configurations to a project. This implementation must include directory structure for profiles, profile schema mirroring main config, contextual application per project, and CLI integration for `agent-ctrl apply profile <profile_name> <platform>`.

## Clarifications

### Session 2026-05-18

- Q: Merge strategy for skills/commands directories → A: Directory-level override; if a profile contains a skill/command directory, the entire directory replaces the base version
- Q: Profile metadata and descriptions → A: No descriptions; list command shows profile directory names only
- Q: Profile scope — project-local vs global → A: Project-local only; profiles exist solely under `.agent-ctrl/profiles/` within each project
- Q: Empty profile behavior → A: Apply base configuration and show informational message that profile was empty
- Q: Conflicting MCP server definitions → A: Field-level merge; profile overrides only specified fields, unspecified fields remain from base

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Apply a Profile to a Project (Priority: P1)

A developer working on a project with an existing `.agent-ctrl` configuration wants to apply a named profile (e.g., "typescript", "godot", "rust") that contains a specific set of agents, commands, MCPs, rules, and skills. They run `agent-ctrl apply profile <profile_name> <platform>` and the profile's configuration is merged with or overrides the project's base configuration, then applied to the target platform.

**Why this priority**: This is the core functionality — without it, profiles provide no value. It directly addresses the PRD goal of multi-agent support and contextual configuration application.

**Independent Test**: Can be fully tested by creating a profile directory with sample artifacts, running the apply command, and verifying the target platform receives the correct merged configuration.

**Acceptance Scenarios**:

1. **Given** a project with a `.agent-ctrl` directory containing a `profiles/typescript/` subdirectory with rules and skills, **When** the user runs `agent-ctrl apply profile typescript claude`, **Then** the typescript profile's rules and skills are applied to the Claude Code configuration for that project.
2. **Given** a profile that defines an MCP server configuration, **When** the user applies it to a platform, **Then** the MCP settings are merged with or replace the project's base `mcp.json` as defined by the profile's override rules.
3. **Given** no profile exists with the specified name, **When** the user runs the apply command, **Then** the CLI returns a clear error message indicating the profile was not found.

---

### User Story 2 - Profile Overrides Base Configuration (Priority: P2)

A developer has a base configuration in `.agent-ctrl/` (rules, skills, agents, etc.) and wants a profile to selectively override specific artifacts while inheriting the rest. When applying the profile, base artifacts not present in the profile remain active, while profile artifacts take precedence.

**Why this priority**: Enables practical reuse — profiles should augment, not fully replace, base configurations. This is essential for real-world workflows where teams maintain a shared baseline with project-specific variations.

**Independent Test**: Can be tested by setting up base artifacts, creating a profile with a subset of overriding artifacts, applying the profile, and verifying the merged output contains both base and profile artifacts with correct precedence.

**Acceptance Scenarios**:

1. **Given** a base configuration with `rules/coding-style.md` and `rules/security.md`, and a profile containing only `rules/security.md` (updated version), **When** the profile is applied, **Then** the profile's `security.md` is used while the base `coding-style.md` remains active.
2. **Given** a profile defines an agent persona not present in the base configuration, **When** the profile is applied, **Then** the new agent persona is added to the applied configuration alongside base agents.

---

### User Story 3 - List Available Profiles (Priority: P3)

A developer wants to see which profiles are available for their current project before applying one. They run a list command and see all profile names.

**Why this priority**: Improves discoverability and reduces errors from typos or forgotten profile names. Useful but not blocking for core functionality.

**Independent Test**: Can be tested by creating multiple profiles and running the list command, verifying all profile names are displayed.

**Acceptance Scenarios**:

1. **Given** a project with `profiles/typescript/`, `profiles/production/`, and `profiles/review/` directories, **When** the user runs the profile list command, **Then** all three profile names are displayed.
2. **Given** a project with no profiles directory, **When** the user runs the list command, **Then** a message indicates no profiles are configured.

---

### Edge Cases

- When the profile directory exists but contains no artifacts, the system applies the base configuration and displays an informational message indicating the profile was empty.
- When base and profile define the same MCP server key with different settings, the system performs a field-level merge: profile-specified fields override base fields, while unspecified fields are retained from the base configuration.
- When the target platform is not supported by any adapter, the system returns a validation error listing available platforms.
- When a profile has missing subdirectories (e.g., no rules/ or skills/), the system loads only the present artifacts and skips missing ones silently.
- When the user runs the apply command from outside a project with `.agent-ctrl`, the system returns a clear error indicating the required directory structure is missing.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST create and recognize a `profiles/` subdirectory within the project's `.agent-ctrl` configuration directory. Profiles are scoped to the individual project only; no global profile directory is supported.
- **FR-002**: Each profile MUST be a named subdirectory under `profiles/` (e.g., `.agent-ctrl/profiles/typescript/`).
- **FR-003**: A profile directory MUST support the same nested structure as the main configuration: `agents/`, `commands/`, `mcps/`, `rules/`, and `skills/`.
- **FR-004**: The CLI MUST provide an `apply profile <profile_name> <platform>` command that locates the specified profile and applies its configuration to the target platform.
- **FR-005**: When applying a profile, the system MUST merge profile artifacts with the project's base configuration, with profile artifacts taking precedence over base artifacts of the same name. For file-based artifacts (rules, agents, MCPs), same-filename overrides apply. For directory-based artifacts (skills, commands), if a profile contains a matching directory, the entire directory replaces the base version.
- **FR-006**: The system MUST validate that the target platform has a corresponding adapter before applying configuration.
- **FR-007**: The system MUST return a clear error if the specified profile does not exist.
- **FR-008**: The system MUST return a clear error if the command is executed outside a project with a `.agent-ctrl` directory.
- **FR-009**: The system MUST support listing available profiles for the current project via a CLI subcommand.
- **FR-010**: Profile application MUST complete within 2 seconds for typical project sizes (consistent with PRD non-functional requirements).
- **FR-011**: The system MUST handle empty profiles by applying the base configuration and displaying an informational message indicating the profile contained no artifacts.
- **FR-012**: MCP server configurations in profiles MUST be merged with base `mcp.json` settings at the field level. For matching server keys, profile-specified fields override base fields while unspecified fields are retained from the base configuration.
- **FR-013**: The system MUST return a validation error listing available platforms when the target platform is not supported by any adapter.
- **FR-014**: The system MUST gracefully handle profiles with missing subdirectories by loading only present artifacts and skipping absent ones.

### Key Entities

- **Profile**: A named collection of agent configuration artifacts (rules, skills, agents, commands, MCPs) stored under `.agent-ctrl/profiles/<name>/` within a single project. Profiles are project-scoped and not shared across projects.
- **Base Configuration**: The default set of artifacts in `.agent-ctrl/` (rules/, skills/, agents/, commands/, mcp.json) that serves as the foundation for profile merging.
- **Platform Adapter**: A translation layer that converts the merged standard configuration into a target platform's specific format (e.g., Claude Code, Gemini, Cursor).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can apply a named profile to a supported platform in under 2 seconds for projects with up to 50 artifacts.
- **SC-002**: 95% of users successfully apply a profile on their first attempt without encountering errors (measured via error rate in apply command execution).
- **SC-003**: Profile merging correctly resolves conflicts between base and profile artifacts in 100% of test cases (verified by automated test suite).
- **SC-004**: Users can discover available profiles for their project within 5 seconds of running the list command.
- **SC-005**: The apply command produces platform-specific output that is functionally equivalent to manually configuring the same artifacts on the target platform.
