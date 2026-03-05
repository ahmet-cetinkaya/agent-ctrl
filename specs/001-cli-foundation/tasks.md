# Tasks: CLI Foundation

**Input**: Design documents from `/specs/001-cli-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-commands.md

**Tests**: Tests are OPTIONAL for this feature. Test tasks are not included unless explicitly requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Project structure follows clean architecture: `src/core/domain/`, `src/core/application/`, `src/infrastructure/`, `src/presentation/cli/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project directory structure per implementation plan (src/core/domain, src/core/application, src/infrastructure, src/presentation/cli, tests/contract, tests/integration, tests/unit)
- [x] T002 Initialize TypeScript project with Bun runtime
- [x] T003 Install Commander.js dependency via bun package manager
- [x] T004 [P] Configure TypeScript compiler (tsconfig.json) with strict mode and path aliases
- [x] T005 [P] Create package.json scripts (dev, build, start, test, lint)
- [x] T006 [P] Configure Bun test runner settings
- [x] T007 Add .gitignore for node_modules, dist, .env files
- [x] T008 Create README.md with project overview and usage instructions

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T009 Create ArtifactType enum in src/core/domain/value-objects/ArtifactType.ts
- [x] T010 [P] Create MARKDOWN_EXTENSIONS constant in src/core/domain/value-objects/FileExtensions.ts
- [x] T011 [P] Create Result type in src/core/domain/value-objects/Result.ts for error handling
- [x] T012 Create Rule entity in src/core/domain/entities/Rule.ts
- [x] T013 [P] Create Skill entity in src/core/domain/entities/Skill.ts
- [x] T014 [P] Create Agent entity in src/core/domain/entities/Agent.ts
- [x] T015 Create Project entity in src/core/domain/entities/Project.ts
- [x] T016 Create Artifact union type in src/core/domain/types/Artifact.ts
- [x] T017-a [P] Implement FileValidator with markdown file validation methods (hasExtension, isReadable, exists) in src/infrastructure/validation/FileValidator.ts
- [x] T017 Create FileValidator interface in src/core/domain/interfaces/IFileValidator.ts
- [x] T018 [P] Implement DirectoryScanner class in src/infrastructure/scanners/DirectoryScanner.ts
- [x] T019 [P] Implement PathResolver utility in src/infrastructure/utils/PathResolver.ts
- [x] T020 Create Error classes (UserError, SystemError) in src/core/domain/errors/
- [x] T021 Create CLI main entry point with Commander.js in src/presentation/cli/index.ts
- [x] T022 Configure global error handling middleware in src/presentation/cli/middleware/errorHandler.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Initialize Agent Control Project (Priority: P1) 🎯 MVP

**Goal**: Enable developers to create a new agent-ctrl project with the standard directory structure (rules/, skills/, agents/, commands/) and a sample configuration file

**Independent Test**: Run `agent-ctrl init` in an empty directory, then verify directories (rules/, skills/, agents/, commands/) and agent-ctrl.config.json are created

### Implementation for User Story 1

- [x] T023 [P] [US1] Create InitCommand in src/presentation/cli/commands/init.ts with Commander.js command definition
- [x] T024 [P] [US1] Create InitUseCase in src/core/application/use-cases/InitUseCase.ts
- [x] T025 [US1] Implement directory validation logic in InitUseCase (check if directory is empty or doesn't exist)
- [x] T026 [US1] Implement directory creation logic in InitUseCase (create rules/, skills/, agents/, commands/)
- [x] T027 [US1] Create sample config template in src/infrastructure/templates/sampleConfig.json with helpful comments
- [x] T028 [US1] Implement config file writing logic in InitUseCase
- [x] T029 [US1] Add success/error message formatting for init command
- [x] T030 [US1] Register init command with CLI in src/presentation/cli/index.ts
- [x] T031 [US1] Add directory-not-empty error handling with clear message
- [x] T032 [US1] Add permission-denied error handling with exit code 2

**Checkpoint**: User Story 1 complete - `agent-ctrl init` creates project structure independently

---

## Phase 4: User Story 2 - Scan and Display Project Artifacts (Priority: P1)

**Goal**: Enable developers to view all available rules, skills, and agents in their project via list commands

**Independent Test**: Create sample files in rules/, skills/, agents/, then run `agent-ctrl rule ls`, `agent-ctrl skill ls`, `agent-ctrl agent ls` to verify all artifacts are discovered and displayed

### Implementation for User Story 2

- [x] T033 [P] [US2] Create RuleScanner in src/infrastructure/scanners/RuleScanner.ts
- [x] T034 [P] [US2] Create SkillScanner in src/infrastructure/scanners/SkillScanner.ts
- [x] T035 [P] [US2] Create AgentScanner in src/infrastructure/scanners/AgentScanner.ts
- [x] T036 [US2] Implement markdown file validation in RuleScanner using FileValidator (.md/.markdown extension, readable) [depends on T017-a]
- [x] T037 [US2] Implement SKILL.md directory validation in SkillScanner using FileValidator (directory contains readable SKILL.md) [depends on T017-a]
- [x] T038 [US2] Implement markdown file validation in AgentScanner using FileValidator (.md/.markdown extension, readable) [depends on T017-a]
- [x] T039 [US2] Implement filename extraction logic (without extension) in all scanners
- [x] T040 [US2] Implement warning collection for invalid/skipped files
- [x] T041 [US2] Create ListRulesCommand in src/presentation/cli/commands/rule_ls.ts
- [x] T042 [P] [US2] Create ListSkillsCommand in src/presentation/cli/commands/skill_ls.ts
- [x] T043 [P] [US2] Create ListAgentsCommand in src/presentation/cli/commands/agent_ls.ts
- [x] T044 [US2] Implement ListRulesUseCase in src/core/application/use-cases/ListRulesUseCase.ts
- [x] T045 [P] [US2] Implement ListSkillsUseCase in src/core/application/use-cases/ListSkillsUseCase.ts
- [x] T046 [P] [US2] Implement ListAgentsUseCase in src/core/application/use-cases/ListAgentsUseCase.ts
- [x] T047 [US2] Add --json flag support to all list commands
- [x] T048 [US2] Implement artifact display formatting (human-readable and JSON)
- [x] T049 [US2] Add empty-directory messaging (no artifacts found)
- [x] T050 [US2] Register all list commands with CLI in src/presentation/cli/index.ts
- [x] T051 [US2] Add directory-not-found error handling for list commands

**Checkpoint**: User Story 2 complete - all list commands discover and display artifacts independently

---

## Phase 5: User Story 3 - Apply Configuration to Claude Code (Priority: P1)

**Goal**: Enable developers to apply their agent configurations to Claude Code by creating/updating Claude-managed files and synced artifact directories

**Independent Test**: Create sample artifacts, run `agent-ctrl apply claude`, then verify `~/.claude/CLAUDE.md` and `~/.claude/.agent-ctrl.json` are created/updated with correct mappings

### Implementation for User Story 3

- [x] T052 [P] [US3] Create ClaudeAdapter interface in src/infrastructure/adapters/IClaudeAdapter.ts
- [x] T053 [US3] Create PlatformAdapter interface in src/core/domain/interfaces/IPlatformAdapter.ts
- [x] T054 [US3] Implement ClaudeAdapter class in src/infrastructure/adapters/ClaudeAdapter.ts
- [x] T055 [US3] Implement Claude Code path resolution (`~/.claude/CLAUDE.md` and `~/.claude/.agent-ctrl.json`)
- [x] T056 [US3] Implement auto-creation of Claude directory if not exists
- [x] T057 [US3] Implement Rule to Claude config format mapping
- [x] T058 [US3] Implement Skill to Claude config format mapping
- [x] T059 [US3] Implement Agent to Claude config format mapping
- [x] T060 [US3] Implement config merge logic (preserve existing non-conflicting entries)
- [x] T061 [US3] Implement ApplyCommand in src/presentation/cli/commands/apply.ts with platform argument
- [x] T062 [US3] Implement ApplyUseCase in src/core/application/use-cases/ApplyUseCase.ts
- [x] T063 [US3] Add --dry-run flag support to apply command
- [x] T064 [US3] Add --override flag support to apply command
- [x] T065 [US3] Implement artifact scanning before apply (re-use scanners from US2)
- [x] T066 [US3] Add no-artifacts warning handling
- [x] T067 [US3] Add permission-denied error handling for config write
- [x] T068 [US3] Add config-locked error handling
- [x] T069 [US3] Register apply command with CLI in src/presentation/cli/index.ts
- [x] T070 [US3] Add success message with artifact counts and config path

**Checkpoint**: User Story 3 complete - `agent-ctrl apply claude` creates/updates Claude Code config independently

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T071 [P] Implement --verbose flag logic for debug output
- [x] T072 [P] Implement --quiet flag logic to suppress warnings
- [x] T073 [P] Add --version command implementation
- [x] T074 [P] Create global help text for all commands
- [x] T075 Add SIGINT (Ctrl+C) handling for graceful shutdown during long operations
- [x] T076 Add path traversal protection validation (ensure all paths within project root)
- [x] T077 Implement special character/space handling in file paths
- [ ] T078 Add large-scale project handling (1000+ files optimization)
- [x] T079 Update README.md with complete usage examples
- [x] T080 Create LICENSE file
- [x] T081 [P] Add CONTRIBUTING.md guidelines
- [x] T082 Run quickstart.md validation to ensure setup instructions work

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (Phase 3): Can start after Foundational - No dependencies on other stories
  - User Story 2 (Phase 4): Can start after Foundational - No dependencies on other stories
  - User Story 3 (Phase 5): Can start after Foundational - Reuses scanners from US2 but independently testable
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Reuses scanner classes from US2 but testable independently

### Within Each User Story

- Models/Scanners before Use Cases
- Use Cases before Commands
- Commands before CLI registration
- Error handling added to each layer
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] (T004, T005, T006, T007) can run in parallel
- All Foundational entity tasks marked [P] (T010, T013, T014) can run in parallel
- All Foundational scanner/utility tasks marked [P] (T018, T019) can run in parallel
- User Story 1 parallel tasks: T023, T024 can run in parallel
- User Story 2 parallel tasks: T033, T034, T035 (scanners) and T042, T043 (commands) can run in parallel
- User Story 3 parallel tasks: T057, T058, T059 (mapping logic) can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 2

```bash
# Launch all scanners for User Story 2 together:
Task: "Create RuleScanner in src/infrastructure/scanners/RuleScanner.ts"
Task: "Create SkillScanner in src/infrastructure/scanners/SkillScanner.ts"
Task: "Create AgentScanner in src/infrastructure/scanners/AgentScanner.ts"

# Launch all list commands for User Story 2 together:
Task: "Create ListSkillsCommand in src/presentation/cli/commands/skill_ls.ts"
Task: "Create ListAgentsCommand in src/presentation/cli/commands/agent_ls.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T022) - CRITICAL
3. Complete Phase 3: User Story 1 (T023-T032)
4. **STOP and VALIDATE**: Run `agent-ctrl init` in empty directory
5. Verify directories and config file created successfully

### Full Feature Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (init) → Test independently → MVP complete!
3. Add User Story 2 (list commands) → Test independently → Discovery complete!
4. Add User Story 3 (apply claude) → Test independently → Core value delivered!
5. Add Polish phase → Production ready

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (init command)
   - Developer B: User Story 2 (list commands)
   - Developer C: User Story 3 (apply command)
3. Stories complete and integrate independently

---

## Summary

| Metric                   | Count |
| ------------------------ | ----- |
| **Total Tasks**          | 82    |
| **Setup Tasks**          | 8     |
| **Foundational Tasks**   | 14    |
| **User Story 1 Tasks**   | 10    |
| **User Story 2 Tasks**   | 19    |
| **User Story 3 Tasks**   | 19    |
| **Polish Tasks**         | 12    |
| **Parallelizable Tasks** | 25+   |

### MVP Scope (User Story 1)

Tasks T001-T032 deliver the minimum viable product:

- Project initialization with standard directory structure
- Sample configuration file creation
- Basic error handling

Each task includes specific file paths for immediate execution.
