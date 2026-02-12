# Implementation Plan: CLI Foundation

**Branch**: `001-cli-foundation` | **Date**: 2025-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-cli-foundation/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a CLI tool (`agent-ctrl`) for managing AI agent configurations using a standard directory-based pattern. The tool enables developers to:

1. Initialize projects with the standard directory structure (rules/, skills/, agents/, commands/)
2. Scan and list artifacts (rules, skills, agents) from the project
3. Apply configurations to target platforms (Claude Code in Phase 1)

The implementation uses Bun as the runtime with Commander.js for CLI parsing, following clean architecture principles with domain/application/infrastructure layers.

## Technical Context

**Language/Version**: TypeScript via Bun (latest LTS)
**Primary Dependencies**: Commander.js (CLI framework), filesystem modules (node:fs)
**Storage**: Local filesystem (markdown files, JSON configuration)
**Testing**: Bun test runner (built-in) or NEEDS CLARIFICATION
**Target Platform**: Cross-platform CLI (macOS, Linux, Windows via Bun)
**Project Type**: single (CLI tool with clean architecture)
**Performance Goals**: <5s init, <1s list (100+ files), <3s apply (10-50 artifacts)
**Constraints**: Must handle 1000+ artifacts gracefully, file system errors must not crash
**Scale/Scope**: Single-user local tool, typical projects have 10-50 artifacts

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Status**: No project constitution exists (`.specify/memory/constitution.md` is a template). Skipping constitution check.

**Note**: Consider creating a project constitution via `/speckit.constitution` to establish project-wide principles and quality gates.

## Project Structure

### Documentation (this feature)

```text
specs/001-cli-foundation/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── domain/         # Domain models (Rule, Skill, Agent, Project)
│   └── application/    # Use cases (init, list, apply, artifact management)
├── infrastructure/     # External integrations (file system, adapters)
│   ├── adapters/       # Platform adapters (ClaudeAdapter, etc.)
│   └── scanners/       # Directory scanning logic
└── presentation/
    └── cli/            # Commander.js interface layer
        ├── commands/   # Individual command handlers
        └── index.ts    # Main entry point

tests/
├── contract/           # Adapter contract tests
├── integration/        # End-to-end CLI tests
└── unit/               # Unit tests for domain/application layers
```

**Structure Decision**: Single project with clean architecture (Option 1). The CLI tool follows domain-driven design with clear separation between business logic (core), external concerns (infrastructure), and user interaction (presentation/cli).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| N/A       | N/A        | N/A                                  |

## Phase 0: Research & Technology Decisions

### Research Tasks

The following technical decisions were resolved:

| Decision      | Choice                   | Rationale                                                           |
| ------------- | ------------------------ | ------------------------------------------------------------------- |
| Runtime       | Bun                      | Fast startup, native TypeScript, modern tooling                     |
| CLI Framework | Commander.js             | Industry standard, well-documented, composable                      |
| File System   | node:fs/node:path        | Built-in Node modules, cross-platform, no extra dependencies        |
| Config Format | JSON                     | Native to Claude Code, simple merge semantics                       |
| Architecture  | Clean Architecture / DDD | Separation of concerns, testability, platform adapter extensibility |

### Key Integration Points

| Integration        | Pattern          | Notes                                                           |
| ------------------ | ---------------- | --------------------------------------------------------------- |
| Claude Code Config | File adapter     | Reads/writes `~/.claude/config.json`, preserves existing config |
| Directory Scanning | Iterator pattern | Single-pass scan, lazy evaluation for large projects            |
| Error Handling     | Result type      | Explicit error handling, no silent failures                     |

See [research.md](./research.md) for detailed findings.
