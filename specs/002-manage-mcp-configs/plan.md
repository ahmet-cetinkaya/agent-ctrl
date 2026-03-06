# Implementation Plan: Dynamic MCP Config Management

**Branch**: `[002-manage-mcp-configs]` | **Date**: 2026-03-05 | **Spec**: [/home/ac/Code/ahmet-cetinkaya/agent-ctrl/specs/002-manage-mcp-configs/spec.md](/home/ac/Code/ahmet-cetinkaya/agent-ctrl/specs/002-manage-mcp-configs/spec.md)
**Input**: Feature specification from `/specs/002-manage-mcp-configs/spec.md`

## Summary

Add dynamic MCP configuration loading from `MCPs/`, parse `mcpServers` JSON entries, load variables from `MCPs/.env`, resolve `${VAR}` placeholders in any string value, pass resolved values into server `env`, and provide deterministic validation/logging with partial-failure tolerance.

## Technical Context

**Language/Version**: TypeScript (`strict`), ES2022 modules on Bun/Node runtime  
**Primary Dependencies**: `commander` (CLI), Bun runtime/test runner, Node `fs/promises`/`path`/`os`  
**Storage**: Local filesystem (`MCPs/*.json`, `MCPs/.env`, platform config files)  
**Testing**: `bun:test` (unit/integration/contract)  
**Target Platform**: Cross-platform CLI runtime (Linux/macOS primary, filesystem-based execution)  
**Project Type**: CLI application with layered architecture (`core` + `infrastructure` + `presentation`)  
**Performance Goals**: Process up to 100 MCP files per load run within 10 seconds for 95% of runs  
**Constraints**: No secret values in logs, deterministic order, partial-failure tolerance, `${VAR}` interpolation in any string value  
**Scale/Scope**: At least 50 valid MCP JSON files and at least 100 total `mcpServers` entries in validation scenarios

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- Constitution file `.specify/memory/constitution.md` defines enforceable MUST-level principles.
- Gate result (pre-research): **PASS** against current plan.
- Operational quality gates used for this feature instead:
- Maintain layered boundaries (`core` independent of `presentation`) per Constitution I.
- Keep requirement behavior testable with unit/integration/contract tests per Constitution III.
- Preserve secure handling of secrets and explicit error messaging per Constitution IV/V.

## Project Structure

### Documentation (this feature)

```text
specs/002-manage-mcp-configs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── mcp-config-file-contract.md
│   └── mcp-load-report-contract.md
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
│   └── domain/
│       └── shared/
│           └── interfaces/
├── infrastructure/
│   ├── features/
│   │   ├── apply/
│   │   ├── claude/
│   │   └── mcp/
│   │       ├── loaders/
│   │       ├── parsers/
│   │       └── validators/
│   └── shared/
│       └── validation/
└── presentation/
    └── cli/
        └── features/
            └── apply/

tests/
├── contract/
│   └── mcp/
├── integration/
│   └── mcp/
└── unit/
    ├── application/Features/
    └── infrastructure/Features/
```

**Structure Decision**: Keep the existing single-project CLI structure and add MCP-specific loaders/parsers/validators under `src/infrastructure/features/mcp/`, orchestrated by the existing apply flow.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| None      | N/A        | N/A                                  |

## Post-Design Constitution Check

- Re-check result (after Phase 1 design): **PASS**.
- Planned design remains aligned with constitutional principles for boundaries, deterministic behavior, test/type gates, and secret handling.
