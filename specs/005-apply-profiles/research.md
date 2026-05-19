# Research: Apply Project Profiles

## Decision: Profile Merge Strategy

**Rationale**: The spec clarifies that profiles merge with base configuration using directory-level override for skills/commands and field-level merge for MCP configs. This aligns with the existing `ApplyMergePolicy.ts` pattern in the codebase.

**Alternatives considered**:
1. Full replacement (profile replaces base entirely) — rejected because it forces profiles to duplicate all base artifacts
2. File-level merge for all artifact types — rejected because skills/commands are directory-based units; partial merges within directories would be confusing

## Decision: Profile Loading via Extended ApplySourceLoader

**Rationale**: The existing `ApplySourceLoader` already scans `.agent-ctrl/{rules,skills,agents,commands}` and loads MCP configs. Adding a `loadProfile(profilePath)` method reuses the same scanners (RuleScanner, SkillScanner, AgentScanner, CommandScanner, McpServerAggregator) and returns the same `ApplySourceSnapshot` shape. This minimizes code duplication.

**Alternatives considered**:
1. Separate ProfileLoader class — rejected because it would duplicate scanner instantiation and loading logic
2. Modify existing load() to accept optional profile path — rejected because it conflates two distinct operations (load base vs load profile)

## Decision: CLI Subcommand Pattern

**Rationale**: Adding `profile` as a subcommand of `apply` (`agent-ctrl apply profile <name> <platform>`) follows the existing Commander.js pattern. The `apply.ts` file already has an `applyToPlatform()` helper that can be reused with a merged source path.

**Alternatives considered**:
1. Separate top-level `profile` command — rejected because profiles are an apply-mode concept, not independent
2. Flag-based approach (`agent-ctrl apply claude --profile debug`) — rejected because the spec explicitly defines `apply profile <name> <platform>` pattern

## Decision: Profile Validation

**Rationale**: Profile existence is validated by checking if `.agent-ctrl/profiles/<name>/` is a directory. Empty profiles are valid and produce an informational message. Invalid structures (missing subdirectories) are tolerated — only present artifacts are loaded.

**Alternatives considered**:
1. Strict schema validation requiring all subdirectories — rejected because profiles should be partial overlays
2. Profile metadata file (profile.json) — rejected during clarification (Q2: no descriptions)

## Decision: Error Handling

**Rationale**: Profile-specific errors use a new `ProfileError` class extending `UserError`. Error codes follow existing `ERROR_IDS` convention. Three error cases:
- Profile not found → `PROFILE_NOT_FOUND`
- Profile path is not a directory → `PROFILE_NOT_DIRECTORY`
- No `.agent-ctrl` directory → existing `CONFIG_ROOT_NOT_FOUND`

**Alternatives considered**:
1. Reuse generic `UserError` — rejected because profile-specific errors need distinct identification for testing and diagnostics
