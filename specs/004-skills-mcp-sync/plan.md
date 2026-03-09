# Implementation Plan: Skills and MCP Sync

**Branch**: `[004-skills-mcp-sync]` | **Date**: 2026-03-08 | **Spec**: [/home/ac/Code/ahmet-cetinkaya/agent-ctrl/specs/004-skills-mcp-sync/spec.md](/home/ac/Code/ahmet-cetinkaya/agent-ctrl/specs/004-skills-mcp-sync/spec.md)
**Input**: Feature specification from `/specs/004-skills-mcp-sync/spec.md`

## Summary

Extend the existing `skill` and `mcp` command groups with remote-catalog discovery, cached synchronization, source-tracked activation/update flows, and compatibility-aware lifecycle management for SkillsMP skills and Smithery MCPs while preserving the repository’s layered CLI architecture and current local listing behavior. Operators inspect catalog items through expanded search and list output rather than a new top-level combined catalog command. The corrected plan uses SkillsMP’s documented search API plus page/download-backed install metadata for scope-based skill discovery, and Smithery’s documented paginated registry API for MCP discovery and detail retrieval.

## Technical Context

**Language/Version**: TypeScript (`strict`), ES2022 modules on Bun/Node runtime  
**Primary Dependencies**: `commander` (CLI), Bun runtime/test runner, Node `fs/promises`/`path`/`os`, built-in `fetch`/`AbortController` for remote catalog access  
**Storage**: Local filesystem under the config root (`skills/`, `mcps/`, and hidden catalog cache/state files for sync metadata and discovery scopes)  
**Testing**: `bun:test` with unit, integration, and contract coverage  
**Target Platform**: Cross-platform CLI (Linux/macOS/Windows), network-enabled runs against SkillsMP and Smithery, filesystem-backed activation state  
**Project Type**: Layered CLI application (`core` + `infrastructure` + `presentation`)  
**Performance Goals**: Cached browse/search completes within 2 seconds for 95% of runs; full refresh completes within 60 seconds for 95% of authorized, reachable runs  
**Constraints**: Deterministic results and ordering, partial-failure tolerance, explicit conflict handling, no secret values in logs, backward-compatible `skill ls`/`mcp ls` local behavior, inspection details surfaced through search/list output, compatibility checks before activation/update, SkillsMP discovery limited by documented search endpoints and 500 requests/day quota, Smithery registry access requires bearer auth and paginated traversal  
**Scale/Scope**: Two upstream registries, paginated Smithery traversal up to documented page limits, query/category-scoped SkillsMP discovery windows plus tracked installed skills, and at least 100 simultaneously managed active items in validation scenarios

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Layered Architecture Boundaries**: PASS. Plan keeps CLI parsing/output in `presentation`, orchestration and policy in `core`, and registry/network/cache/filesystem integrations in `infrastructure`.
- **II. Deterministic Configuration Behavior**: PASS. Plan requires explicit source-tagged state, stable filtering/searching, source-scope tracking for SkillsMP discovery windows, partial-result summaries, and no silent overrides for conflicts or incompatibilities.
- **III. Test and Type Safety Gates**: PASS. Plan includes unit coverage for sync/compatibility/cache policies, integration tests for source-tracked activation flows, and contract tests for CLI behavior and persisted state formats.
- **IV. Security and Secret Handling**: PASS. Plan keeps credentials out of persisted logs/output, resolves authentication at execution time, and fails closed when protected source access is required but unavailable.
- **V. CLI Observability and Usability**: PASS. Plan defines human-readable and machine-readable summaries for sync, search, activation, deactivation, and update operations, with clear partial-failure reporting.

## Project Structure

### Documentation (this feature)

```text
specs/004-skills-mcp-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── catalog-sync-state-contract.md
│   ├── cli-mcp-registry-contract.md
│   └── cli-skill-registry-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── application/
│   │   └── features/
│   │       ├── skill/
│   │       │   ├── commands/
│   │       │   └── queries/
│   │       └── mcp/
│   │           ├── commands/
│   │           └── queries/
│   └── domain/
│       └── shared/
│           ├── entities/
│           └── interfaces/
├── infrastructure/
│   └── features/
│       ├── catalog/
│       │   ├── caching/
│       │   ├── clients/
│       │   ├── compatibility/
│       │   ├── scopes/
│       │   └── reporting/
│       ├── skill/
│       │   ├── metadata/
│       │   ├── registries/
│       │   └── scanners/
│       └── mcp/
│           ├── loaders/
│           ├── metadata/
│           ├── registries/
│           ├── reporting/
│           └── validators/
└── presentation/
    └── cli/
        └── features/
            ├── skill/
            │   └── commands/
            └── mcp/
                └── commands/

tests/
├── contract/
│   └── cli/
├── integration/
│   ├── skill/
│   └── mcp/
└── unit/
    ├── application/Features/
    └── infrastructure/Features/
```

**Structure Decision**: Keep the existing single-project CLI structure, add shared remote-catalog infrastructure under `src/infrastructure/features/catalog/`, track query/category discovery scopes for SkillsMP, and extend the current `skill` and `mcp` feature slices with source-aware commands and queries rather than introducing a separate top-level product surface.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

## Phase 0: Research

- Completed in `research.md`.
- Focus areas: command-surface compatibility, SkillsMP discovery/install reality, Smithery registry behavior, cache/state persistence, source-auth/rate-limit handling, MCP activation representation, and compatibility evaluation policy.

## Phase 1: Design & Contracts

- Completed in `data-model.md`, `contracts/`, and `quickstart.md`.
- Design defines unified catalog entities, discovery-scope tracking, managed activation records, sync/reporting state, CLI command contracts, and operator validation steps.

## Phase 2: Planning Readiness

- Research and design artifacts resolve the technical unknowns for sync, cache, auth, compatibility, activation lifecycle behavior, and source-specific discovery limits.
- Feature is ready for `/speckit.tasks` decomposition.

## Post-Design Constitution Check

- **I. Layered Architecture Boundaries**: PASS. Shared remote-catalog logic is isolated in infrastructure and exposed through core-level commands/queries only.
- **II. Deterministic Configuration Behavior**: PASS. Contracts and data model define explicit source state, item availability markers, discovery scopes, and conflict/partial-failure outcomes.
- **III. Test and Type Safety Gates**: PASS. Planned artifacts name concrete unit, integration, and contract validation targets aligned with strict TypeScript boundaries.
- **IV. Security and Secret Handling**: PASS. Research and contracts require sanitized error/report output and non-persistence of raw credentials.
- **V. CLI Observability and Usability**: PASS. Quickstart and CLI contracts define actionable command summaries, cached-vs-fresh indicators, and machine-readable output expectations.
