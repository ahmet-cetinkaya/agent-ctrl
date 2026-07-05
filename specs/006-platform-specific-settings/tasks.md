---
description: "Task list for Platform-Specific Settings Support feature implementation"
---

# Tasks: Platform-Specific Settings Support

**Input**: Design documents from `/specs/006-platform-specific-settings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included as this feature requires comprehensive validation for security and backward compatibility requirements.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below follow single project structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create core/filestore module directory structure in src/core/filestore/
- [x] T002 [P] Add TypeScript strict mode configuration to tsconfig.json if not present
- [x] T003 [P] Set up project linting and formatting rules

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create PlatformSettingsDirectory type interface in src/core/domain/shared/types/
- [x] T005 [P] Create FileOperation type interface in src/core/domain/shared/types/
- [x] T006 [P] Create PlatformValidationResult type interface in src/core/domain/shared/types/
- [x] T007 [P] Create SecurityValidationResult type interface in src/core/domain/shared/types/
- [x] T008 Export updated types from src/core/domain/shared/types/index.ts
- [x] T009 [P] Create path traversal validator in src/core/filestore/validators.ts
- [x] T010 [P] Create symbolic link detector in src/core/filestore/symlink-handler.ts
- [x] T011 Implement file copier with override semantics in src/core/filestore/copiers.ts
- [x] T012 [P] Create security validation service in src/core/filestore/security-service.ts
- [x] T013 Add unit tests for path traversal validation in tests/unit/core/filestore/validators.test.ts
- [x] T014 [P] Add unit tests for symbolic link detection in tests/unit/core/filestore/symlink-handler.test.ts
- [x] T015 [P] Add unit tests for file copying operations in tests/unit/core/filestore/copiers.test.ts
- [x] T016 Add integration tests for security validation in tests/integration/core/filestore/security-validation.test.ts
- [x] T017 [P] Create PlatformConfigPath type interface and resolution function in src/core/domain/platform-paths.ts (resolves CLAUDE_CONFIG_DIR, CODEX_HOME, GEMINI_CONFIG_DIR, OPENCODE_CONFIG_DIR, FORGE_CONFIG, XDG_CONFIG_HOME per platform-paths.md)
- [x] T018 [P] Add unit tests for platform config path resolution in tests/unit/core/domain/platform-paths.test.ts (covers all 10 platforms, env var overrides, XDG, cursor unsupported-global case)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Platform-Specific Configuration Management (Priority: P1) 🎯 MVP

**Goal**: Enable developers to define platform-specific settings in separate directories without conflicts

**Independent Test**: Create platform-specific settings directory, run apply command for a platform, verify only correct platform settings are applied

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T019 [P] [US1] Contract test for platform validation in tests/contract/settings-application/platform-validation.test.ts
- [x] T020 [P] [US1] Contract test for file operations in tests/contract/settings-application/file-operations.test.ts
- [x] T021 [P] [US1] Integration test for basic platform settings application in tests/integration/adapters/platform-settings-basic.test.ts
- [x] T022 [P] [US1] Integration test for backward compatibility without settings directory in tests/integration/adapters/platform-settings-compat.test.ts

### Implementation for User Story 1

- [x] T023 [P] [US1] Extend configuration scanner to discover settings/ directory in src/config/scanner.ts
- [x] T024 [P] [US1] Add platform directory name validation logic in src/config/validator.ts
- [x] T025 [US1] Create settings discovery service in src/core/filestore/settings-discovery.ts
- [x] T026 [US1] Integrate security validation for settings paths in src/config/scanner.ts (validateDirectory)
- [x] T027 [P] [US1] Platform-specific settings copy handled centrally in ApplyCommand (no per-adapter change needed)
- [x] T028 [P] [US1] Platform-specific settings copy handled centrally in ApplyCommand (no per-adapter change needed)
- [x] T029 [P] [US1] Platform-specific settings copy handled centrally in ApplyCommand (no per-adapter change needed)
- [x] T030 [US1] Integrate platform-specific settings in ApplyCommand.ts (discover + copy after adapter apply)
- [x] T031 [US1] Verbose mode surfaces settings warnings via existing warnings channel in apply.ts
- [x] T032 [US1] Error handling for invalid platform names in validator.ts + ApplyCommand
- [x] T033 [US1] Success/failure summary pushed to warnings ("Applied N platform-specific setting(s)")
- [x] T034 [P] [US1] Add unit tests for configuration scanner in tests/unit/config/scanner.test.ts
- [x] T035 [P] [US1] Add unit tests for platform validation logic in tests/unit/config/validator.test.ts
- [x] T036 [P] [US1] Settings discovery covered by scanner.test.ts (duplicate settings-discovery.ts removed)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Multi-Platform Configuration Application (Priority: P2)

**Goal**: Enable apply command to intelligently handle platform-specific settings for multiple platforms in a single operation

**Independent Test**: Create multiple platform-specific settings directories, run apply command for multiple platforms, verify each platform receives correct settings

### Tests for User Story 2

- [ ] T037 [P] [US2] Integration test for multi-platform settings application in tests/integration/adapters/platform-settings-multiple.test.ts
- [ ] T038 [P] [US2] Integration test for partial platform settings in tests/integration/adapters/platform-settings-partial.test.ts

### Implementation for User Story 2

- [ ] T039 [P] [US2] Extend apply command to handle multiple platforms in src/cli/commands/apply.ts
- [ ] T040 [US2] Add platform-specific settings isolation in src/cli/commands/apply.ts
- [ ] T041 [P] [US2] Add multi-platform progress reporting in src/cli/commands/apply.ts
- [ ] T042 [P] [US2] Add unit tests for multi-platform command logic in tests/unit/cli/commands/apply.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Settings Directory Discovery and Validation (Priority: P3)

**Goal**: Provide clear feedback about platform-specific settings discovery for troubleshooting configuration issues

**Independent Test**: Create various platform-specific directory structures, run apply commands with verbose flags, verify proper discovery messages

### Tests for User Story 3

- [ ] T043 [P] [US3] Integration test for verbose mode output in tests/integration/cli/platform-settings-verbose.test.ts
- [ ] T044 [P] [US3] Integration test for invalid platform handling in tests/integration/cli/platform-settings-invalid.test.ts

### Implementation for User Story 3

- [ ] T045 [P] [US3] Enhance verbose mode with detailed settings discovery info in src/cli/commands/apply.ts
- [ ] T046 [P] [US3] Add discoverability logging for settings operations in src/cli/commands/apply.ts
- [ ] T047 [P] [US3] Improve error messages for invalid platform directories in src/cli/commands/apply.ts
- [ ] T048 [P] [US3] Add unit tests for verbose mode enhancements in tests/unit/cli/commands/apply-verbose.test.ts
- [ ] T049 [P] [US3] Add unit tests for enhanced error messages in tests/unit/cli/commands/apply-errors.test.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T050 [P] Update README.md with platform-specific settings documentation
- [ ] T051 [P] Add usage examples to documentation
- [ ] T052 [P] Performance optimization for file operations in src/core/filestore/copiers.ts
- [ ] T053 [P] Additional security hardening in src/core/filestore/security-service.ts
- [ ] T054 Run quickstart.md validation scenarios
- [ ] T055 [P] Update CLAUDE.md with any new context or commands
- [ ] T056 [P] Add contract tests for security edge cases in tests/contract/settings-application/security-edge-cases.test.ts
- [ ] T057 Final integration test suite for complete platform settings workflow in tests/integration/platform-settings-complete.test.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Extends US1 apply command but maintains independence
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Enhances US1 apply command output but maintains independence

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD approach)
- Type interfaces before implementations
- Security validators before file operations
- Core discovery logic before adapter integration
- CLI command extensions last in each story
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for platform validation in tests/contract/settings-application/platform-validation.test.ts"
Task: "Contract test for file operations in tests/contract/settings-application/file-operations.test.ts"
Task: "Integration test for basic platform settings application in tests/integration/adapters/platform-settings-basic.test.ts"
Task: "Integration test for backward compatibility in tests/integration/adapters/platform-settings-compat.test.ts"
```

---

## Parallel Example: User Story 1 Models

```bash
# Launch type interface creation together:
Task: "Create PlatformSettingsDirectory type interface in src/core/domain/shared/types/"
Task: "Create FileOperation type interface in src/core/domain/shared/types/"
Task: "Create PlatformValidationResult type interface in src/core/domain/shared/types/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Validate all acceptance scenarios for US1 pass
6. Validate backward compatibility maintained

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Validate MVP
3. Add User Story 2 → Test independently → Validate multi-platform
4. Add User Story 3 → Test independently → Validate discoverability
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Platform-specific config management)
   - Developer B: User Story 2 (Multi-platform application)
   - Developer C: User Story 3 (Discovery and validation)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Focus on security validation throughout all phases
- Maintain backward compatibility as critical requirement
- Performance target: apply commands complete within 2 seconds
