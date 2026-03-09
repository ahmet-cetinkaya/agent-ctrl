# Tasks: Skills and MCP Sync

**Input**: Design documents from `/specs/004-skills-mcp-sync/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included because the constitution and plan require unit, integration, and contract coverage for changed behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the feature scaffolding required by the implementation plan

- [x] T001 Create the shared catalog feature barrel in `src/infrastructure/features/catalog/index.ts`
- [x] T002 Create the skill command export barrel in `src/core/application/features/skill/commands/index.ts`
- [x] T003 [P] Create the MCP command export barrel in `src/core/application/features/mcp/commands/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core catalog state and integration infrastructure that MUST exist before any user story work can start

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create source registry and discovery scope entities in `src/core/domain/shared/entities/SourceRegistry.ts` and `src/core/domain/shared/entities/DiscoveryScope.ts`
- [x] T005 [P] Create catalog item and managed integration entities in `src/core/domain/shared/entities/CatalogItem.ts` and `src/core/domain/shared/entities/ManagedIntegration.ts`
- [x] T006 [P] Create compatibility assessment, sync report, and operation log entities in `src/core/domain/shared/entities/CompatibilityAssessment.ts`, `src/core/domain/shared/entities/SyncReport.ts`, and `src/core/domain/shared/entities/OperationLogEntry.ts`
- [x] T007 [P] Create catalog state and remote registry interfaces in `src/core/domain/shared/interfaces/ICatalogStateStore.ts`, `src/core/domain/shared/interfaces/ISkillsMpClient.ts`, and `src/core/domain/shared/interfaces/ISmitheryRegistryClient.ts`
- [x] T008 Implement the file-backed catalog state store in `src/infrastructure/features/catalog/caching/CatalogStateFileStore.ts`
- [x] T009 [P] Implement shared discovery-scope planning and operation reporting in `src/infrastructure/features/catalog/scopes/DiscoveryScopePlanner.ts` and `src/infrastructure/features/catalog/reporting/CatalogOperationReportBuilder.ts`
- [x] T010 Update shared exports and feature error identifiers in `src/core/domain/shared/entities/index.ts`, `src/core/domain/shared/interfaces/index.ts`, and `src/core/domain/shared/constants/errorIds.ts`

**Checkpoint**: Foundation ready. User story work can now begin.

---

## Phase 3: User Story 1 - Discover and Inspect Available Integrations (Priority: P1) 🎯 MVP

**Goal**: Operators can synchronize source discovery data, search/filter results, and inspect integration descriptions, capabilities, source metadata, and compatibility state.

**Independent Test**: Run `skill sync --query "code review"` and `mcp sync`, then use `skill search`, `mcp search`, `skill ls`, and `mcp ls` to confirm catalog results expose inspection details, deduplicated entries, source freshness, version, capability, and compatibility data.

### Tests for User Story 1

- [x] T011 [P] [US1] Add skill registry CLI contract coverage for search/list inspection fields and sync summaries in `tests/contract/cli/SkillRegistryCliContract.test.ts`
- [x] T012 [P] [US1] Add MCP registry CLI contract coverage for search/list inspection fields and sync summaries in `tests/contract/cli/McpRegistryCliContract.test.ts`
- [x] T013 [P] [US1] Add scoped discovery, deduplication, and inspection-flow integration tests in `tests/integration/skill/SkillCatalogDiscovery.test.ts` and `tests/integration/mcp/McpCatalogDiscovery.test.ts`

### Implementation for User Story 1

- [x] T014 [P] [US1] Implement the SkillsMP discovery client in `src/infrastructure/features/catalog/clients/SkillsMpClient.ts`
- [x] T015 [P] [US1] Implement the Smithery registry client in `src/infrastructure/features/catalog/clients/SmitheryRegistryClient.ts`
- [x] T016 [P] [US1] Implement skill catalog synchronization in `src/infrastructure/features/skill/registries/SkillCatalogSynchronizer.ts`
- [x] T017 [P] [US1] Implement MCP catalog synchronization in `src/infrastructure/features/mcp/registries/McpCatalogSynchronizer.ts`
- [x] T018 [US1] Implement skill search and sync application flows with scoped discovery and inspection result shaping in `src/core/application/features/skill/queries/SearchSkillsQuery.ts` and `src/core/application/features/skill/commands/SyncSkillsCommand.ts`
- [x] T019 [US1] Implement MCP search and sync application flows with inspection result shaping in `src/core/application/features/mcp/queries/SearchMcpCatalogQuery.ts` and `src/core/application/features/mcp/commands/SyncMcpCatalogCommand.ts`
- [x] T020 [US1] Add skill search and sync CLI subcommands in `src/presentation/cli/features/skill/commands/skill_search.ts` and `src/presentation/cli/features/skill/commands/skill_sync.ts`
- [x] T021 [US1] Add MCP search and sync CLI subcommands in `src/presentation/cli/features/mcp/commands/mcp_search.ts` and `src/presentation/cli/features/mcp/commands/mcp_sync.ts`
- [x] T022 [US1] Wire search and sync subcommands into `src/presentation/cli/features/skill/commands/skill.ts` and `src/presentation/cli/features/mcp/commands/mcp.ts`
- [x] T023 [US1] Extend search and local list rendering with cached catalog freshness, discovery metadata, and explicit inspection fields in `src/presentation/cli/features/skill/commands/skill_search.ts`, `src/presentation/cli/features/mcp/commands/mcp_search.ts`, `src/presentation/cli/features/skill/commands/skill_ls.ts`, and `src/presentation/cli/features/mcp/commands/mcp_ls.ts`

**Checkpoint**: User Story 1 should now be independently functional as the MVP discovery slice.

---

## Phase 4: User Story 2 - Activate and Deactivate Individual Integrations (Priority: P2)

**Goal**: Operators can activate or deactivate one compatible skill or MCP while preserving source metadata, compatibility checks, and unrelated local artifacts.

**Independent Test**: Activate one cached skill and one cached MCP, confirm local managed artifacts are created and tracked, then deactivate them and verify the managed history remains while unrelated local content is unchanged.

### Tests for User Story 2

- [x] T024 [P] [US2] Add skill activation CLI contract coverage in `tests/contract/cli/SkillActivationCliContract.test.ts`
- [x] T025 [P] [US2] Add MCP activation CLI contract coverage in `tests/contract/cli/McpActivationCliContract.test.ts`
- [x] T026 [P] [US2] Add activation, deactivation, unavailable-item blocking, and history-retention integration coverage in `tests/integration/skill/SkillActivationFlow.test.ts` and `tests/integration/mcp/McpActivationFlow.test.ts`

### Implementation for User Story 2

- [x] T027 [P] [US2] Implement catalog compatibility evaluation in `src/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator.ts`
- [x] T028 [P] [US2] Implement skill installation materialization and metadata writing in `src/infrastructure/features/skill/metadata/SkillInstallMaterializer.ts`
- [x] T029 [P] [US2] Implement managed MCP materialization in `src/infrastructure/features/mcp/metadata/ManagedMcpMaterializer.ts`
- [x] T030 [US2] Implement skill activation and deactivation application flows, backed by add/remove commands, with unavailable-item blocking and historical record retention in `src/core/application/features/skill/commands/AddSkillCommand.ts` and `src/core/application/features/skill/commands/RemoveSkillCommand.ts`
- [x] T031 [US2] Implement MCP activation and deactivation application flows, backed by add/remove commands, with unavailable-item blocking and historical record retention in `src/core/application/features/mcp/commands/AddMcpCommand.ts` and `src/core/application/features/mcp/commands/RemoveMcpCommand.ts`
- [x] T032 [US2] Add skill activation and deactivation CLI subcommands in `src/presentation/cli/features/skill/commands/skill_add.ts` and `src/presentation/cli/features/skill/commands/skill_rm.ts`
- [x] T033 [US2] Add MCP activation and deactivation CLI subcommands in `src/presentation/cli/features/mcp/commands/mcp_add.ts` and `src/presentation/cli/features/mcp/commands/mcp_rm.ts`
- [x] T034 [US2] Wire activation-state rendering and activation/deactivation subcommands into `src/presentation/cli/features/skill/commands/skill.ts`, `src/presentation/cli/features/mcp/commands/mcp.ts`, `src/presentation/cli/features/skill/commands/skill_ls.ts`, and `src/presentation/cli/features/mcp/commands/mcp_ls.ts`

**Checkpoint**: User Stories 1 and 2 should both work, with US2 independently testable once catalog data exists.

---

## Phase 5: User Story 3 - Keep Catalog and Active Integrations Current (Priority: P3)

**Goal**: Operators can refresh discovery scopes, update managed items, and receive clear cache/auth/rate-limit/partial-failure feedback.

**Independent Test**: Refresh cached discovery scopes, simulate one source auth or quota failure, run `update --all --refresh`, and confirm the command reports updated, unchanged, skipped, failed, and cached outcomes without corrupting managed state.

### Tests for User Story 3

- [x] T035 [P] [US3] Add update and sync CLI contract coverage in `tests/contract/cli/RegistryUpdateCliContract.test.ts`
- [x] T036 [P] [US3] Add refresh, bulk-update, and refresh-time-budget integration coverage in `tests/integration/skill/SkillUpdateFlow.test.ts` and `tests/integration/mcp/McpUpdateFlow.test.ts`
- [x] T037 [P] [US3] Add cache freshness, no-extra-request, auth fail-closed, rate-limit, and credential-redaction resilience tests in `tests/unit/infrastructure/Features/catalog/CatalogSyncResilience.test.ts` and `tests/contract/cli/RegistrySecurityOutputContract.test.ts`

### Implementation for User Story 3

- [x] T038 [P] [US3] Implement operation log persistence in `src/infrastructure/features/catalog/caching/CatalogOperationLogStore.ts`
- [x] T039 [P] [US3] Implement cache freshness and throttling policy in `src/infrastructure/features/catalog/caching/CatalogCachePolicy.ts`
- [x] T040 [P] [US3] Implement skill update orchestration in `src/core/application/features/skill/commands/UpdateSkillCommand.ts`
- [x] T041 [P] [US3] Implement MCP update orchestration in `src/core/application/features/mcp/commands/UpdateMcpCommand.ts`
- [x] T042 [US3] Add auth-, quota-, partial-failure-, and unavailable-item-aware refresh behavior to `src/infrastructure/features/skill/registries/SkillCatalogSynchronizer.ts` and `src/infrastructure/features/mcp/registries/McpCatalogSynchronizer.ts`
- [x] T043 [US3] Add skill update CLI behavior and refresh flags in `src/presentation/cli/features/skill/commands/skill_update.ts` and `src/presentation/cli/features/skill/commands/skill_sync.ts`
- [x] T044 [US3] Add MCP update CLI behavior and refresh flags in `src/presentation/cli/features/mcp/commands/mcp_update.ts` and `src/presentation/cli/features/mcp/commands/mcp_sync.ts`
- [x] T045 [US3] Surface sync and update summaries with last-success timestamps in `src/presentation/cli/features/skill/commands/skill_ls.ts` and `src/presentation/cli/features/mcp/commands/mcp_ls.ts`

**Checkpoint**: All user stories should now be independently functional, including cache-aware refresh and update flows.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize docs, operational guidance, and validation

- [x] T046 [P] Update user-facing command documentation in `docs/COMMANDS.md` and `docs/INTEGRATIONS.md`
- [x] T047 [P] Add auth, quota, cache, and compatibility troubleshooting guidance in `docs/TROUBLESHOOTING.md`
- [x] T048 [P] Update implementation notes for the new catalog architecture in `docs/DEVELOPMENT.md` and `docs/ARCHITECTURE.md`
- [x] T049 Validate the operator flows in `specs/004-skills-mcp-sync/quickstart.md`
- [x] T050 Run the required quality gates and performance/cache validation suites with `bun test` and `bun run type-check`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup**: No dependencies
- **Phase 2: Foundational**: Depends on Phase 1 and blocks all user story work
- **Phase 3: User Story 1**: Depends on Phase 2
- **Phase 4: User Story 2**: Depends on Phase 2 and uses the catalog/discovery foundation completed in User Story 1
- **Phase 5: User Story 3**: Depends on Phase 2 and builds on the managed activation/update flows introduced in User Stories 1 and 2
- **Phase 6: Polish**: Depends on the user stories you intend to ship

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2 and delivers the MVP discovery slice
- **User Story 2 (P2)**: Builds on catalog records created by User Story 1 but remains independently testable once seeded discovery data exists
- **User Story 3 (P3)**: Builds on managed integrations from User Story 2 and discovery scopes from User Story 1

### Suggested Completion Order

1. Phase 1 → Phase 2
2. User Story 1
3. User Story 2
4. User Story 3
5. Phase 6 Polish

---

## Parallel Opportunities

- T003 can run alongside T001-T002 after setup starts
- T004-T009 can run in parallel where file ownership does not overlap
- T011-T013 can run in parallel for User Story 1 test coverage
- T014-T017 can run in parallel for User Story 1 provider and synchronizer work
- T024-T026 can run in parallel for User Story 2 test coverage
- T027-T029 can run in parallel for User Story 2 infrastructure work
- T035-T037 can run in parallel for User Story 3 test coverage
- T038-T041 can run in parallel for User Story 3 cache and update orchestration work
- T046-T048 can run in parallel during polish

---

## Parallel Example: User Story 1

```bash
# Run User Story 1 contract and integration tests in parallel
Task: "T011 [US1] Add skill registry CLI contract coverage in tests/contract/cli/SkillRegistryCliContract.test.ts"
Task: "T012 [US1] Add MCP registry CLI contract coverage in tests/contract/cli/McpRegistryCliContract.test.ts"
Task: "T013 [US1] Add discovery flow integration tests in tests/integration/skill/SkillCatalogDiscovery.test.ts and tests/integration/mcp/McpCatalogDiscovery.test.ts"

# Build provider clients and synchronizers in parallel
Task: "T014 [US1] Implement the SkillsMP discovery client in src/infrastructure/features/catalog/clients/SkillsMpClient.ts"
Task: "T015 [US1] Implement the Smithery registry client in src/infrastructure/features/catalog/clients/SmitheryRegistryClient.ts"
Task: "T016 [US1] Implement skill catalog synchronization in src/infrastructure/features/skill/registries/SkillCatalogSynchronizer.ts"
Task: "T017 [US1] Implement MCP catalog synchronization in src/infrastructure/features/mcp/registries/McpCatalogSynchronizer.ts"
```

## Parallel Example: User Story 2

```bash
# Run User Story 2 tests in parallel
Task: "T024 [US2] Add skill activation CLI contract coverage in tests/contract/cli/SkillActivationCliContract.test.ts"
Task: "T025 [US2] Add MCP activation CLI contract coverage in tests/contract/cli/McpActivationCliContract.test.ts"
Task: "T026 [US2] Add activation, deactivation, unavailable-item blocking, and history-retention integration coverage in tests/integration/skill/SkillActivationFlow.test.ts and tests/integration/mcp/McpActivationFlow.test.ts"

# Build activation infrastructure in parallel
Task: "T027 [US2] Implement catalog compatibility evaluation in src/infrastructure/features/catalog/compatibility/CatalogCompatibilityEvaluator.ts"
Task: "T028 [US2] Implement skill installation materialization and metadata writing in src/infrastructure/features/skill/metadata/SkillInstallMaterializer.ts"
Task: "T029 [US2] Implement managed MCP materialization in src/infrastructure/features/mcp/metadata/ManagedMcpMaterializer.ts"
```

## Parallel Example: User Story 3

```bash
# Run User Story 3 tests in parallel
Task: "T035 [US3] Add update and sync CLI contract coverage in tests/contract/cli/RegistryUpdateCliContract.test.ts"
Task: "T036 [US3] Add refresh, bulk-update, and refresh-time-budget integration coverage in tests/integration/skill/SkillUpdateFlow.test.ts and tests/integration/mcp/McpUpdateFlow.test.ts"
Task: "T037 [US3] Add cache freshness, no-extra-request, auth fail-closed, rate-limit, and credential-redaction resilience tests in tests/unit/infrastructure/Features/catalog/CatalogSyncResilience.test.ts and tests/contract/cli/RegistrySecurityOutputContract.test.ts"

# Build cache and update orchestration in parallel
Task: "T038 [US3] Implement operation log persistence in src/infrastructure/features/catalog/caching/CatalogOperationLogStore.ts"
Task: "T039 [US3] Implement cache freshness and throttling policy in src/infrastructure/features/catalog/caching/CatalogCachePolicy.ts"
Task: "T040 [US3] Implement skill update orchestration in src/core/application/features/skill/commands/UpdateSkillCommand.ts"
Task: "T041 [US3] Implement MCP update orchestration in src/core/application/features/mcp/commands/UpdateMcpCommand.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate discovery, filtering, and inspectability from cached and fresh sync data
5. Stop for review before activation/update work

### Incremental Delivery

1. Deliver User Story 1 as the discovery MVP
2. Add User Story 2 to enable activation and deactivation of managed integrations
3. Add User Story 3 to complete refresh, update, quota, and partial-failure behavior
4. Finish with docs and validation in Phase 6

### Parallel Team Strategy

1. One engineer completes Setup and Foundational phases
2. After Phase 2:
   - Engineer A takes provider clients and discovery sync tasks for User Story 1
   - Engineer B takes activation materialization tasks for User Story 2 once User Story 1 catalog records are available
   - Engineer C takes cache/update resilience tasks for User Story 3 after activation flows exist

---

## Notes

- Every task uses the required checklist format with task ID, optional `[P]`, optional `[US#]`, and file path
- User stories are sliced so each phase can be validated independently
- Tests are included because the constitution and plan require behavior coverage
- User Story 1 is the suggested MVP scope
