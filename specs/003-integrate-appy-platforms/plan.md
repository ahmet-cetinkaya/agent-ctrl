# Implementation Plan: Apply Platform Apply Integration

**Branch**: `[003-integrate-apply-platforms]` | **Date**: 2026-03-06 | **Spec**: [specs/003-integrate-apply-platforms/spec.md](specs/003-integrate-apply-platforms/spec.md)
**Input**: Feature specification from `/specs/003-integrate-apply-platforms/spec.md`

## Summary

Extend the existing `apply` flow from a single supported platform to eight selectable targets (`opencode`, `gemini`, `qwen`, `kilo`, `antigravity`, `codex`, `cursor`, `windsurf`) so each run configures the `apply` integration artifact for exactly one platform, preserves unrelated settings, replaces conflicting `apply` entries, enforces documented scope precedence where applicable, and returns deterministic status (`success`/`unchanged`/`failure`).

## Technical Context

**Language/Version**: TypeScript (`strict`), ES2022 modules on Bun/Node runtime  
**Primary Dependencies**: `commander` (CLI), Bun runtime/test runner, Node `fs/promises`/`path`/`os`  
**Storage**: Local filesystem (platform-specific config files and existing state files)  
**Testing**: `bun:test` for unit/integration/contract coverage  
**Target Platform**: Cross-platform CLI (Linux/macOS/Windows), local filesystem writes per selected platform  
**Project Type**: Layered CLI application (`core` + `infrastructure` + `presentation`)  
**Performance Goals**: 95% of selected-platform apply runs complete within 5 seconds for typical projects (10-50 artifacts)  
**Constraints**: Single-platform argument is mandatory; unchanged outcome returns success; unsupported/missing platform returns usage error with no writes; deterministic and idempotent config updates; documented user/project scope precedence must be applied consistently  
**Scale/Scope**: 8 supported targets, one platform processed per run, repeated runs must converge without duplicate `apply` entries

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Layered Architecture Boundaries**: PASS. Plan keeps CLI parsing in `presentation`, orchestration in `core`, and per-platform file integrations in `infrastructure` adapters.
- **II. Deterministic Configuration Behavior**: PASS. Plan enforces explicit selected-platform processing, replace-conflict behavior for `apply`, and unchanged/success semantics.
- **III. Test and Type Safety Gates**: PASS. Plan includes unit/integration/contract tests and preserves strict TypeScript typing.
- **IV. Security and Secret Handling**: PASS. Plan reuses sanitized error handling conventions and does not introduce secret-value logging in apply outputs.
- **V. CLI Observability and Usability**: PASS. Plan adds clear selected-platform result messages and actionable errors for unsupported/missing platform input.

## Project Structure

### Documentation (this feature)

```text
specs/003-integrate-apply-platforms/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── cli-apply-apply-contract.md
│   └── platform-apply-config-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── application/
│   │   └── features/
│   │       └── apply/
│   │           └── commands/
│   │               └── ApplyCommand.ts
│   └── domain/
│       └── shared/
│           └── interfaces/
│               └── IPlatformAdapter.ts
├── infrastructure/
│   └── features/
│       ├── claude/
│       │   └── adapters/
│       ├── opencode/
│       │   └── adapters/
│       ├── gemini/
│       │   └── adapters/
│       ├── qwen/
│       │   └── adapters/
│       ├── kilo/
│       │   └── adapters/
│       ├── antigravity/
│       │   └── adapters/
│       ├── codex/
│       │   └── adapters/
│       ├── cursor/
│       │   └── adapters/
│       └── windsurf/
│           └── adapters/
└── presentation/
    └── cli/
        └── features/
            └── apply/
                └── commands/
                    └── apply.ts

tests/
├── unit/
│   ├── application/Features/commands/
│   └── infrastructure/Features/
├── integration/
│   └── apply/
└── contract/
    └── cli/
```

**Structure Decision**: Keep the existing single-project CLI structure and extend the current apply flow with a selected-platform adapter registry and one adapter per supported target.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

## Phase 0: Research

- Completed in `research.md`.
- Focus areas: per-platform `apply` integration contract, adapter-selection strategy, deterministic merge/replace behavior, and CLI status semantics.

## Phase 1: Design & Contracts

- Completed in `data-model.md`, `contracts/`, and `quickstart.md`.
- Design defines selected-platform request/outcome entities, `apply` entry lifecycle, and CLI command contract for missing/unsupported platform behavior.

## Phase 2: Planning Readiness

- Research and design artifacts are consistent with the spec and constitution.
- Feature is ready for `/speckit.tasks` decomposition.

## Post-Design Constitution Check

- **I. Layered Architecture Boundaries**: PASS. Adapter expansion remains in infrastructure and does not invert dependencies.
- **II. Deterministic Configuration Behavior**: PASS. Contracts explicitly define single-platform runs and replace-conflict/idempotent behavior.
- **III. Test and Type Safety Gates**: PASS. Planned artifacts define unit/integration/contract validation targets.
- **IV. Security and Secret Handling**: PASS. No secret-bearing output expansion; error reporting remains actionable and sanitized.
- **V. CLI Observability and Usability**: PASS. Output contract defines clear selected-platform status and failure causes.
