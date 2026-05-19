# Tasks: Apply Project Profiles

**Input**: Design documents from `/specs/005-apply-profiles/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/apply-profile-command.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project CLI structure under `src/` and `tests/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add error constants for profile-specific errors

- [ ] T001 Add `PROFILE_NOT_FOUND` and `PROFILE_NOT_DIRECTORY` to ERROR_IDS in `src/core/domain/shared/constants/errorIds.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core domain entities, infrastructure scanning, and merge logic that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T002 [P] Create Profile entity in `src/core/domain/shared/entities/Profile.ts` with fields: name, path, configRoot, artifactPaths; include validation for name pattern `[a-zA-Z0-9_-]+`
- [ ] T003 [P] Create ProfileError class in `src/core/domain/shared/errors/ProfileError.ts` extending UserError with profileName field and error code support
- [ ] T004 [P] Create ProfileMerger service in `src/core/application/features/apply/services/ProfileMerger.ts` implementing: (a) file-based artifact merge by filename (profile wins), (b) directory-based artifact merge for skills/commands (profile directory replaces base), (c) field-level MCP merge for matching server keys, (d) empty profile detection returning base-only snapshot
- [ ] T005 Create ProfileScanner in `src/infrastructure/features/apply/adapters/ProfileScanner.ts` that resolves a profile path, validates it is a directory, scans for optional subdirectories (rules/, skills/, agents/, commands/), loads MCP config from profile's `mcp.json` if present, and returns an ApplySourceSnapshot using the existing scanners (RuleScanner, SkillScanner, AgentScanner, CommandScanner, McpServerAggregator)
- [ ] T006 Add `loadProfile(profilePath: string)` method to ApplySourceLoader in `src/infrastructure/features/apply/adapters/ApplySourceLoader.ts` that delegates to ProfileScanner and returns ApplySourceSnapshot
- [ ] T007 Write unit tests for ProfileMerger in `tests/unit/ProfileMerger.test.ts` covering: file override, directory override for skills, directory override for commands, field-level MCP merge, empty profile returns base
- [ ] T008 Write unit tests for ProfileScanner in `tests/unit/ProfileScanner.test.ts` covering: valid profile with all subdirs, profile with partial subdirs, empty profile, non-existent path throws, path is file throws

**Checkpoint**: Foundation ready — Profile entity, error handling, scanning, and merge logic are complete and tested

---

## Phase 3: User Story 1 - Apply a Profile to a Project (Priority: P1) 🎯 MVP

**Goal**: Developer runs `agent-ctrl apply profile <name> <platform>` and the profile's configuration is merged with base and applied to the target platform

**Independent Test**: Create a profile directory with sample rules and skills, run the apply command, verify the target platform receives the merged configuration

### Implementation for User Story 1

- [ ] T009 [US1] Create ApplyProfileCommand in `src/core/application/features/apply/commands/ApplyProfileCommand.ts` with execute() method that: validates profile exists, loads base snapshot via ApplySourceLoader.load(), loads profile snapshot via ApplySourceLoader.loadProfile(), merges via ProfileMerger.merge(), applies merged snapshot through PlatformAdapterRegistry.resolve(platform).applyApplyIntegration(), returns ApplyCommandResult with merged artifact counts
- [ ] T010 [US1] Add `profile` subcommand to apply.ts in `src/presentation/cli/features/apply/commands/apply.ts` as `new Command("profile").argument("<profile_name>").argument("<platform>")` that delegates to ApplyProfileCommand.execute() with existing dry-run/override/verbose options
- [ ] T011 [US1] Add empty profile detection in `src/presentation/cli/features/apply/commands/apply.ts` CLI handler: when merged result has no profile artifacts, display informational message "Profile '<name>' contained no artifacts. Base configuration applied."
- [ ] T012 [US1] Add error handling in `src/presentation/cli/features/apply/commands/apply.ts` for ProfileError: display "Profile '<name>' not found in .agent-ctrl/profiles/" for PROFILE_NOT_FOUND, exit code 1
- [ ] T013 [US1] Write unit tests for ApplyProfileCommand in `tests/unit/ApplyProfileCommand.test.ts` covering: successful apply with profile, profile not found error, empty profile applies base only, platform adapter receives merged snapshot
- [ ] T014 [US1] Write integration test in `tests/integration/apply-profile.test.ts` covering end-to-end flow: create temp project with .agent-ctrl/profiles/test/, add test rules, run apply profile test claude --no-prompt, verify Claude config includes profile rules

**Checkpoint**: User Story 1 is fully functional — `agent-ctrl apply profile <name> <platform>` works end-to-end

---

## Phase 4: User Story 2 - Profile Overrides Base Configuration (Priority: P2)

**Goal**: Profile selectively overrides specific base artifacts while inheriting the rest; base artifacts not in profile remain active

**Independent Test**: Set up base artifacts, create profile with subset of overriding artifacts, apply profile, verify merged output contains both base and profile artifacts with correct precedence

### Implementation for User Story 2

- [ ] T015 [US2] Write integration test in `tests/integration/apply-profile.test.ts` for partial override: base has rules/coding-style.md + rules/security.md, profile has only rules/security.md (updated), verify applied config includes base coding-style.md and profile security.md
- [ ] T016 [US2] Write integration test in `tests/integration/apply-profile.test.ts` for additive profile: profile defines agent persona not in base, verify applied config includes both base agents and new profile agent
- [ ] T017 [US2] Write integration test in `tests/integration/apply-profile.test.ts` for directory-level skill override: base has skill "git-workflow", profile has skill "git-workflow" with different SKILL.md, verify profile version replaces base entirely
- [ ] T018 [US2] Write integration test in `tests/integration/apply-profile.test.ts` for field-level MCP merge: base and profile define same MCP server key with different fields, verify profile fields override while unspecified base fields are retained
- [ ] T024 [US2] Write contract test in `tests/contract/apply-profile-contract.test.ts` verifying the `apply profile <name> <platform>` command schema: correct argument parsing, option flags (--dry-run, --override, --verbose, --no-prompt), exit codes (0 success, 1 user error, 2 system error), and output format
- [ ] T025 [US2] Add edge case tests in `tests/integration/apply-profile.test.ts`: unsupported platform returns adapter validation error, profile with invalid file structure (missing subdirectories) loads only present artifacts, command run outside project with .agent-ctrl returns clear error

**Checkpoint**: User Stories 1 AND 2 both work independently — merge behavior is correct for all override scenarios

---

## Phase 5: User Story 3 - List Available Profiles (Priority: P3)

**Goal**: Developer can see which profiles are available for their current project before applying one

**Independent Test**: Create multiple profile directories, run the list command, verify all profile names are displayed

### Implementation for User Story 3

- [ ] T019 [US3] Create ProfileListCommand in `src/core/application/features/apply/commands/ProfileListCommand.ts` with execute() method that: resolves .agent-ctrl/profiles/ directory, reads subdirectory names, returns sorted list of profile names
- [ ] T020 [US3] Add `list` subcommand to apply profile command in `src/presentation/cli/features/apply/commands/apply.ts` as `profile.command("list")` that delegates to ProfileListCommand.execute() and displays profile names
- [ ] T021 [US3] Handle no-profiles case in `src/presentation/cli/features/apply/commands/apply.ts`: when profiles/ directory does not exist or is empty, display "No profiles configured for this project."
- [ ] T022 [US3] Write unit tests for ProfileListCommand in `tests/unit/ProfileListCommand.test.ts` covering: multiple profiles listed, empty profiles directory, no profiles directory
- [ ] T023 [US3] Write integration test in `tests/integration/apply-profile.test.ts` for list command: create temp project with profiles/debug/, profiles/production/, run apply profile list, verify both names displayed

**Checkpoint**: All user stories are independently functional — apply, merge, and list all work correctly

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T026 [P] Update help text in `src/presentation/cli/features/apply/commands/apply.ts` to document `apply profile <name> <platform>` and `apply profile list` subcommands
- [ ] T027 [P] Add dry-run support for profile apply in `src/presentation/cli/features/apply/commands/apply.ts`: when --dry-run flag is set, display merged artifact counts without writing to platform
- [ ] T028 Run `bun test` to verify all tests pass
- [ ] T029 Run `bun run type-check` to verify TypeScript strict mode compliance
- [ ] T030 Run `bun run format` and `bun run lint` to ensure code quality
- [ ] T031 Validate quickstart.md scenarios by manually running each example command

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion (T002–T008)
- **User Story 2 (Phase 4)**: Depends on Foundational phase completion; builds on US1 infrastructure
- **User Story 3 (Phase 5)**: Depends on Foundational phase completion; independent of US1/US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) — integration tests depend on US1 apply flow existing
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) — No dependencies on US1/US2

### Within Each User Story

- Models/entities before services
- Services before CLI wiring
- Core implementation before integration tests
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003, T004 can run in parallel (different files, no dependencies)
- T005 depends on T004 (ProfileScanner uses merge-aware snapshot structure)
- T006 depends on T005 (ApplySourceLoader.loadProfile delegates to ProfileScanner)
- T007, T008 can run in parallel once T004, T005 are complete
- T019, T020, T021, T022, T023 (US3 tasks) can start as soon as Foundational is done — no dependency on US1/US2
- T026, T027 (Polish) can run in parallel once all user stories are complete

---

## Parallel Example: Foundational Phase

```bash
# Launch all parallel foundational tasks together:
Task: "Create Profile entity in src/core/domain/shared/entities/Profile.ts"
Task: "Create ProfileError class in src/core/domain/shared/errors/ProfileError.ts"
Task: "Create ProfileMerger service in src/core/application/features/apply/services/ProfileMerger.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002–T008) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T009–T014)
4. **STOP and VALIDATE**: Run `agent-ctrl apply profile <test> claude` with a test profile
5. Demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Apply profile works end-to-end (MVP!)
3. Add User Story 2 → Test independently → Merge behavior verified for all scenarios
4. Add User Story 3 → Test independently → Profile listing works
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (apply profile command)
   - Developer B: User Story 3 (list profiles) — no dependency on US1
3. User Story 2 integration tests added after US1 is complete
4. Polish phase last

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- ProfileScanner reuses existing scanners (RuleScanner, SkillScanner, etc.) — no new scanning logic needed
- ProfileMerger is the core new logic — file-level override for rules/agents, directory-level for skills/commands, field-level for MCP
