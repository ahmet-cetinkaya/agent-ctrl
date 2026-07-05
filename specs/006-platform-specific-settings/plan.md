# Implementation Plan: Platform-Specific Settings Support

**Branch**: `006-platform-specific-settings` | **Date**: 2025-06-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-platform-specific-settings/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature implements platform-specific configuration support for agent-ctrl by introducing a new `settings/` subdirectory in the project configuration structure. Each supported platform (antigravity, claude, codex, cursor, forgecode, gemini, kilo, opencode, qwen, windsurf) can have its own settings folder containing any files and directories that should be copied exactly as-is to the platform's configuration directory during the `apply` command.

The technical approach extends the existing adapter architecture to:

1. Discover and validate platform-specific settings directories
2. Implement secure file copying with path traversal controls and symbolic link warnings
3. Override (replace) standard configuration files with platform-specific versions when conflicts exist
4. Provide clear discoverability feedback about which settings are being applied

## Technical Context

**Language/Version**: TypeScript with Bun runtime (strict mode)  
**Primary Dependencies**: Commander.js (CLI), existing adapter architecture, Zod (validation), Node.js fs module (filesystem operations)  
**Storage**: File-based configuration (project-local settings/ directory, platform config directories)  
**Testing**: Bun test framework with unit, integration, and contract tests  
**Target Platform**: Cross-platform CLI (Linux, macOS, Windows)  
**Project Type**: CLI tool  
**Performance Goals**: Apply commands must complete within 2 seconds (SC-002)  
**Constraints**: Must maintain 100% backward compatibility (SC-003), support only validated platform names, implement path traversal security controls  
**Scale/Scope**: Supports up to 11 platforms, any number of files/directories per platform, existing project structure

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Layered Architecture Boundaries (I)

✅ **PASS**: Feature extends existing adapter architecture in `src/adapters/`, maintaining dependency direction from infrastructure → core. New settings discovery logic belongs in core domain (filesystem operations, validation) while adapters use core contracts.

### Deterministic Configuration Behavior (II)

✅ **PASS**: File copying behavior is deterministic (same source → same destination). Conflicts produce explicit outcomes (platform-specific files override standard files completely). Error handling isolates failures (invalid platform names, path traversal issues).

### Test and Type Safety Gates (III)

✅ **PASS**: Feature will include comprehensive test coverage (unit tests for validation logic, integration tests for file operations, contract tests for adapter behavior). TypeScript strict mode will be maintained. Must pass `bun test` and `bun run type-check` before delivery.

### Security and Secret Handling (IV)

✅ **PASS**: Implements path traversal controls and symbolic link warnings (FR-009, clarification). File operations follow security best practices. Error messages identify problematic files/paths but don't expose secret values.

### CLI Observability and Usability (V)

✅ **PASS**: Provides clear discoverability feedback (FR-010, verbose mode). Success/failure summaries indicate which settings were applied and any validation issues. User-visible changes will include updated documentation.

### Backward Compatibility

✅ **PASS**: Explicit requirement (FR-006, SC-003) ensures existing projects without settings/ directory continue to work without modification.

## Project Structure

### Documentation (this feature)

```text
specs/006-platform-specific-settings/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── platform-paths.md    # Verified config dir paths per platform (research)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── domain/
│   │   └── shared/
│   │       └── types/
│   │           └── SupportedApplyPlatform.ts  # Platform validation constants
│   └── filestore/           # NEW: Filesystem operations
│       ├── validators.ts     # Path traversal validation
│       ├── copiers.ts        # Secure file copying logic
│       └── symlink-handler.ts # Symbolic link detection/warnings
├── adapters/                # EXISTING: Platform-specific adapters
│   ├── claude-adapter.ts     # Extended to use settings discovery
│   ├── gemini-adapter.ts     # Extended to use settings discovery
│   └── cursor-adapter.ts     # Extended to use settings discovery
├── config/                   # EXISTING: Configuration management
│   ├── scanner.ts            # Extended to discover settings/ directory
│   └── validator.ts          # Extended to validate platform names
└── cli/                      # EXISTING: Command-line interface
    └── commands/
        └── apply.ts           # Extended to integrate platform-specific settings

tests/
├── unit/
│   ├── core/filestore/       # NEW: Unit tests for file operations
│   └── config/               # EXISTING: Extended for settings discovery
├── integration/
│   └── adapters/             # EXISTING: Extended integration tests
└── contract/
    └── settings-application/ # NEW: Contract tests for settings behavior
```

**Structure Decision**: Single CLI project structure selected. This maintains the existing agent-ctrl architecture while adding new core domain logic for secure filesystem operations. The `core/filestore/` module encapsulates security-sensitive file operations, while adapters remain focused on platform-specific transformation logic. This preserves layered architecture boundaries (infrastructure → core dependencies) and maintains testability.

## Complexity Tracking

> **No constitutional violations - this section not applicable**
