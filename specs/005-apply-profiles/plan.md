# Implementation Plan: Apply Project Profiles

**Branch**: `005-apply-profiles` | **Date**: 2026-05-18 | **Spec**: [specs/005-apply-profiles/spec.md](../spec.md)
**Input**: Feature specification from `/specs/005-apply-profiles/spec.md`

## Summary

Add a `profile` subcommand to the existing `apply` command (`agent-ctrl apply profile <profile_name> <platform>`) that loads artifacts from `.agent-ctrl/profiles/<name>/`, merges them with the base configuration (profile takes precedence), and applies the merged result to the target platform via existing adapters. Profiles are project-scoped only.

## Technical Context

**Language/Version**: TypeScript 5.9+ (strict mode)
**Primary Dependencies**: Commander.js (CLI), existing ApplyCommand/ApplySourceLoader/PlatformAdapterRegistry
**Storage**: Local filesystem (`.agent-ctrl/profiles/` directories)
**Testing**: Bun test runner (`bun test`)
**Target Platform**: Linux/macOS/Windows (Node.js/Bun runtime)
**Project Type**: CLI tool
**Performance Goals**: Profile application completes in under 2 seconds for projects with up to 50 artifacts
**Constraints**: Must preserve existing `apply <platform>` behavior unchanged; profiles are additive
**Scale/Scope**: Single project scope; no global profiles

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Layered Architecture | PASS | New code follows `core → infrastructure → presentation` layers. `core/application/` contains `ApplyProfileCommand` and `ProfileMerger`; `infrastructure/` contains `ProfileScanner`; `presentation/cli/` wires the CLI subcommand. |
| II. Deterministic Behavior | PASS | Merge strategy is deterministic: profile overrides base for same-name files, directory-level override for skills/commands, field-level merge for MCP configs. No silent overrides — empty profiles produce explicit info message. |
| III. Test & Type Safety | PASS | Unit tests for `ProfileMerger`, `ProfileScanner`, `ApplyProfileCommand`; integration test for end-to-end flow. TypeScript strict mode preserved throughout. |
| IV. Security & Secrets | PASS | No new secret handling introduced. Profile loading uses same filesystem patterns as base config loading. |
| V. CLI Observability | PASS | Clear success/failure messages. Empty profile produces informational message. Error messages identify missing profile name without revealing filesystem paths beyond `.agent-ctrl/profiles/`. |

_Post-design re-evaluation: All gates pass. No violations to document in Complexity Tracking._

## Project Structure

### Documentation (this feature)

```text
specs/005-apply-profiles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── application/features/apply/
│   │   ├── commands/
│   │   │   └── ApplyProfileCommand.ts   # NEW: profile-specific apply logic
│   │   └── services/
│   │       └── ProfileMerger.ts         # NEW: merge profile with base config
│   └── domain/shared/
│       ├── entities/
│       │   └── Profile.ts               # NEW: profile entity
│       └── errors/
│           └── ProfileError.ts          # NEW: profile-specific errors
├── infrastructure/features/
│   └── apply/
│       └── adapters/
│           ├── ApplySourceLoader.ts     # Extended: add loadProfile() method
│           └── ProfileScanner.ts        # NEW: scan profile directories
└── presentation/cli/features/apply/
    └── commands/
        └── apply.ts                     # Extended: add profile subcommand

tests/
├── unit/
│   ├── ProfileMerger.test.ts
│   ├── ProfileScanner.test.ts
│   ├── ApplyProfileCommand.test.ts
│   └── ProfileListCommand.test.ts
├── integration/
│   └── apply-profile.test.ts
└── contract/
    └── apply-profile-contract.test.ts
```

**Structure Decision**: Single project CLI structure. New files follow existing layered architecture conventions. The `ApplyProfileCommand` is a new use-case in `core/application/`, `ProfileMerger` handles merge logic, `ProfileScanner` handles filesystem scanning in `infrastructure/`, and the CLI extension adds a `profile` subcommand to the existing `apply` command.

## Complexity Tracking

No constitution violations. The design reuses existing adapters, scanners, and the ApplyCommand pattern.
