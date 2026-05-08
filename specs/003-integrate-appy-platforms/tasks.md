# Tasks: Apply Platform Apply Integration

**Input**: Design documents from `/specs/003-integrate-apply-platforms/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The plan and constitution require unit/integration/contract coverage for changed behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: User story label (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create scaffolding for multi-platform apply implementation.

- [x] T001 Create apply adapter registry folder and barrel export in `src/infrastructure/features/apply/adapters/index.ts`
- [x] T002 [P] Create Gemini adapter scaffold files in `src/infrastructure/features/gemini/adapters/GeminiAdapter.ts` and `src/infrastructure/features/gemini/adapters/index.ts`
- [x] T003 [P] Create Qwen adapter scaffold files in `src/infrastructure/features/qwen/adapters/QwenAdapter.ts` and `src/infrastructure/features/qwen/adapters/index.ts`
- [x] T004 [P] Create Kilo adapter scaffold files in `src/infrastructure/features/kilo/adapters/KiloAdapter.ts` and `src/infrastructure/features/kilo/adapters/index.ts`
- [x] T005 [P] Create Antigravity, Codex, Cursor, and Windsurf adapter scaffold files in `src/infrastructure/features/antigravity/adapters/AntigravityAdapter.ts`, `src/infrastructure/features/antigravity/adapters/index.ts`, `src/infrastructure/features/codex/adapters/CodexAdapter.ts`, `src/infrastructure/features/codex/adapters/index.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, `src/infrastructure/features/cursor/adapters/index.ts`, `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`, and `src/infrastructure/features/windsurf/adapters/index.ts`
- [x] T006 [P] Create apply integration test fixture tree in `tests/integration/apply/fixtures/README.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core apply abstractions required by all user stories.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [x] T007 Define supported apply platform type and parser in `src/core/domain/shared/types/SupportedApplyPlatform.ts`
- [x] T008 Extend platform adapter interface for platform-native apply artifacts in `src/core/domain/shared/interfaces/IPlatformAdapter.ts`
- [x] T009 Implement platform adapter registry and resolution in `src/infrastructure/features/apply/adapters/PlatformAdapterRegistry.ts`
- [x] T010 Refactor adapter selection in apply command to use registry in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T011 Update CLI argument help and supported-platform list in `src/presentation/cli/features/apply/commands/apply.ts`
- [x] T012 Add foundational platform selection tests (supported, unsupported, missing argument) in `tests/unit/application/Features/commands/ApplyCommand.test.ts`
- [x] T013 Add CLI contract baseline test for argument and exit behavior in `tests/contract/cli/ApplyCliContract.test.ts`

**Checkpoint**: Foundational platform resolution and CLI argument behavior are stable.

---

## Phase 3: User Story 1 - Apply Apply To A Selected Platform (Priority: P1) 🎯 MVP

**Goal**: Configure `apply` for exactly one selected platform with platform-native artifacts.

**Independent Test**: Run `apply` for one platform and verify only that platform receives valid managed `apply` integration without duplicate entries.

### Tests for User Story 1

- [x] T014 [P] [US1] Add OpenCode adapter unit tests for create/replace/preserve behavior in `tests/unit/infrastructure/Features/adapters/OpenCodeAdapter.test.ts`
- [x] T015 [P] [US1] Add Gemini adapter unit tests for TOML command create/replace behavior in `tests/unit/infrastructure/Features/adapters/GeminiAdapter.test.ts`
- [x] T016 [P] [US1] Add Qwen adapter unit tests for managed command upsert behavior in `tests/unit/infrastructure/Features/adapters/QwenAdapter.test.ts`
- [x] T017 [P] [US1] Add Kilo adapter unit tests for managed command upsert behavior in `tests/unit/infrastructure/Features/adapters/KiloAdapter.test.ts`
- [x] T018 [P] [US1] Add Antigravity, Codex, Cursor, and Windsurf adapter unit tests for documented customization-surface apply behavior in `tests/unit/infrastructure/Features/adapters/AntigravityAdapter.test.ts`, `tests/unit/infrastructure/Features/adapters/CodexAdapter.test.ts`, `tests/unit/infrastructure/Features/adapters/CursorAdapter.test.ts`, and `tests/unit/infrastructure/Features/adapters/WindsurfAdapter.test.ts`
- [x] T019 [P] [US1] Add selected-platform apply integration matrix test in `tests/integration/apply/PlatformApplyFlow.test.ts`

### Implementation for User Story 1

- [x] T020 [US1] Implement OpenCode apply integration adapter in `src/infrastructure/features/opencode/adapters/OpenCodeAdapter.ts`
- [x] T021 [US1] Implement Gemini apply integration adapter in `src/infrastructure/features/gemini/adapters/GeminiAdapter.ts`
- [x] T022 [US1] Implement Qwen apply integration adapter in `src/infrastructure/features/qwen/adapters/QwenAdapter.ts`
- [x] T023 [US1] Implement Kilo apply integration adapter in `src/infrastructure/features/kilo/adapters/KiloAdapter.ts`
- [x] T024 [US1] Implement Antigravity, Codex, Cursor, and Windsurf apply integration adapters in `src/infrastructure/features/antigravity/adapters/AntigravityAdapter.ts`, `src/infrastructure/features/codex/adapters/CodexAdapter.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, and `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`
- [x] T025 [US1] Register platform adapters for opencode/gemini/qwen/kilo/antigravity/codex/cursor/windsurf in `src/infrastructure/features/apply/adapters/PlatformAdapterRegistry.ts`
- [x] T026 [US1] Integrate apply artifact generation and selected-platform write flow in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T027 [P] [US1] Add user-level vs project-level precedence tests for command scope resolution (including Cursor and Windsurf rule scopes) in `tests/unit/infrastructure/Features/adapters/CommandScopePrecedenceResolver.test.ts`
- [x] T028 [US1] Implement command scope precedence resolver for user/project surfaces in `src/infrastructure/features/apply/adapters/CommandScopePrecedenceResolver.ts`

**Checkpoint**: User Story 1 is independently functional for all eight selected platforms.

---

## Phase 4: User Story 2 - Get Clear Targeted Results (Priority: P2)

**Goal**: Provide explicit selected-platform success/unchanged/failure status and actionable failures.

**Independent Test**: Run apply with writable and non-writable selected-platform targets and verify clear status and failure reason output.

### Tests for User Story 2

- [x] T029 [P] [US2] Add CLI contract tests for selected-platform status and exit semantics in `tests/contract/cli/ApplyCliContract.test.ts`
- [x] T030 [P] [US2] Add integration tests for actionable failure reporting on path/permission errors in `tests/integration/apply/PlatformApplyErrors.test.ts`

### Implementation for User Story 2

- [x] T031 [US2] Extend apply result model with selected-platform status payload in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T032 [US2] Implement failure mapping to actionable platform-specific error messages in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T033 [US2] Update CLI rendering for success/unchanged/failure selected-platform output in `src/presentation/cli/features/apply/commands/apply.ts`

**Checkpoint**: User Story 2 is independently testable with explicit status and diagnostics.

---

## Phase 5: User Story 3 - Safe Re-Apply Behavior (Priority: P3)

**Goal**: Ensure reruns are idempotent, replace conflicts, avoid duplicates, and report `unchanged` as success.

**Independent Test**: Run apply twice for the same platform and verify second run returns unchanged (success) with no duplicate managed apply entries.

### Tests for User Story 3

- [x] T034 [P] [US3] Add integration tests for rerun idempotency and conflict replacement in `tests/integration/apply/PlatformApplyIdempotency.test.ts`
- [x] T035 [P] [US3] Add unit tests for unchanged detection and duplicate prevention in `tests/unit/application/Features/commands/ApplyCommand.test.ts`

### Implementation for User Story 3

- [x] T036 [US3] Implement deterministic unchanged detection in apply orchestration in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T037 [US3] Implement shared apply merge policy for replace-conflict/no-duplicate guarantees in `src/infrastructure/features/apply/adapters/ApplyMergePolicy.ts`
- [x] T038 [US3] Apply shared merge policy across platform adapters in `src/infrastructure/features/opencode/adapters/OpenCodeAdapter.ts`, `src/infrastructure/features/gemini/adapters/GeminiAdapter.ts`, `src/infrastructure/features/qwen/adapters/QwenAdapter.ts`, `src/infrastructure/features/kilo/adapters/KiloAdapter.ts`, `src/infrastructure/features/antigravity/adapters/AntigravityAdapter.ts`, `src/infrastructure/features/codex/adapters/CodexAdapter.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, and `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`
- [x] T039 [US3] Ensure unchanged result maps to success exit behavior in `src/presentation/cli/features/apply/commands/apply.ts`

**Checkpoint**: User Story 3 is independently functional with stable rerun semantics.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, documentation, and validation.

- [x] T040 [P] Update usage and troubleshooting documentation for supported platforms, error remediation, and single-target behavior in `docs/COMMANDS.md` and `docs/TROUBLESHOOTING.md`
- [x] T041 [P] Update architecture adapter matrix for platform-native apply artifacts in `docs/ARCHITECTURE.md`
- [x] T042 Validate quickstart scenario coverage and refresh expected outcomes in `specs/003-integrate-apply-platforms/quickstart.md`
- [x] T043 Run full test and type-check validation and record result notes in `specs/003-integrate-apply-platforms/quickstart.md`
- [x] T044 [P] Add SC-001 performance/outcome protocol validation (>=320 runs, >=40 per platform, duration+outcome capture) in `tests/integration/apply/PlatformApplyPerformance.test.ts`
- [x] T045 [P] Add remediation-time integration validation for SC-004 in `tests/integration/apply/PlatformApplyRemediationTime.test.ts`
- [x] T046 [P] Add contract tests ensuring documented customization surfaces are used per platform (including Codex, Cursor, and Windsurf documented behavior) in `tests/contract/cli/PlatformCustomizationSurfaceContract.test.ts`
- [x] T047 [P] Validate and refresh documented customization-surface baseline references used by contracts in `specs/003-integrate-apply-platforms/research.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies
- **Phase 2 (Foundational)**: Depends on Phase 1; blocks all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 3 completion (shared apply orchestration files)
- **Phase 5 (US3)**: Depends on Phase 4 completion (re-apply behavior validates final output and status flows)
- **Phase 6 (Polish)**: Depends on completion of all targeted user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational phase; no dependency on other user stories
- **US2 (P2)**: Starts after US1 core orchestration tasks are complete
- **US3 (P3)**: Depends on US2 (requires completed output/status behavior and base integration from US1)

### Dependency Graph

- `Setup -> Foundational -> US1 -> US2 -> US3 -> Polish`

---

## Parallel Execution Examples

### User Story 1

```bash
# Parallel adapter unit tests
T014, T015, T016, T017, T018

# Parallel adapter implementations after tests are in place
T020, T021, T022, T023, T024
```

### User Story 2

```bash
# Parallel validation of CLI behavior and error reporting
T029, T030
```

### User Story 3

```bash
# Parallel idempotency verification tasks
T034, T035
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate US1 independently via `tests/integration/apply/PlatformApplyFlow.test.ts`.
4. Demo/deploy MVP behavior for selected-platform apply integration.

### Incremental Delivery

1. Deliver US1 (core integration for all target platforms).
2. Deliver US2 (clear status and actionable failures).
3. Deliver US3 (idempotent re-apply guarantees).
4. Finish polish and regression validation.

### Parallel Team Strategy

1. Team finishes Setup + Foundational together.
2. After US1 core orchestration is complete, split by story-level validation and output work.
3. Start US3 after US2 checkpoint is complete.

---

## Notes

- All task lines follow required checklist format: `- [ ] T### [P] [US#] Description with file path`.
- `[P]` tasks target separate files and can run concurrently.
- Each user story phase includes independent test criteria and executable test tasks.
