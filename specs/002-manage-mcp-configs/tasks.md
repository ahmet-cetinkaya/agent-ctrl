# Tasks: Dynamic MCP Config Management

**Input**: Design documents from `/specs/002-manage-mcp-configs/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create MCP feature module scaffolding and wire base exports.

- [x] T001 Create MCP feature directories in `src/infrastructure/features/mcp/{loaders,parsers,validators,interpolation,reporting}`
- [x] T002 Create MCP test directories in `tests/{unit,integration,contract}/mcp`
- [x] T003 Create MCP feature barrel exports in `src/infrastructure/features/mcp/index.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared MCP primitives required by all user stories.

- [x] T004 Define MCP domain contracts and result types in `src/core/domain/shared/interfaces/IMcpConfigLoader.ts`
- [x] T005 [P] Implement MCP path resolver for config root and `MCPs` folder in `src/infrastructure/features/mcp/loaders/McpPathResolver.ts`
- [x] T006 [P] Implement MCP load report model and mapper in `src/infrastructure/features/mcp/reporting/McpLoadReportBuilder.ts`
- [x] T007 Implement shared MCP JSON file reader abstraction in `src/infrastructure/features/mcp/loaders/McpFileReader.ts`
- [x] T008 Integrate MCP loader dependency entrypoint for apply flow in `src/infrastructure/features/apply/index.ts`

**Checkpoint**: Foundational MCP infrastructure is complete; user stories can proceed.

---

## Phase 3: User Story 1 - Load MCP Servers Automatically (Priority: P1) 🎯 MVP

**Goal**: Discover all MCP JSON files in `MCPs/`, parse `mcpServers`, and load valid server entries in deterministic order.

**Independent Test**: Place multiple valid MCP JSON files in `MCPs/` and verify all server entries load in one apply run.

- [x] T009 [P] [US1] Implement deterministic MCP file discovery (`*.json`) in `src/infrastructure/features/mcp/loaders/McpFileDiscovery.ts`
- [x] T010 [P] [US1] Implement `mcpServers` JSON parser in `src/infrastructure/features/mcp/parsers/McpServersParser.ts`
- [x] T011 [US1] Implement duplicate server key conflict detector across files in `src/infrastructure/features/mcp/validators/McpServerConflictValidator.ts`
- [x] T012 [US1] Implement MCP server aggregation pipeline for discovered files in `src/infrastructure/features/mcp/loaders/McpServerAggregator.ts`
- [x] T013 [US1] Integrate MCP aggregation into apply command orchestration in `src/core/application/features/apply/commands/ApplyCommand.ts`
- [x] T014 [US1] Expose MCP load outcomes in CLI apply output in `src/presentation/cli/features/apply/commands/apply.ts`

**Checkpoint**: User Story 1 is independently functional and testable.

---

## Phase 4: User Story 2 - Resolve Variables From MCPs/.env (Priority: P2)

**Goal**: Load `MCPs/.env`, resolve `${VAR}` in any JSON string, and pass resolved values into each server `env`.

**Independent Test**: Create `MCPs/.env` and MCP JSON placeholders, then verify resolved values are injected into runtime server env.

- [x] T015 [P] [US2] Implement `.env` loader for `MCPs/.env` in `src/infrastructure/features/mcp/loaders/McpEnvFileLoader.ts`
- [x] T016 [P] [US2] Implement `${VAR}` interpolation scanner for arbitrary JSON string fields in `src/infrastructure/features/mcp/interpolation/McpInterpolationScanner.ts`
- [x] T017 [US2] Implement placeholder resolver using `MCPs/.env` variables in `src/infrastructure/features/mcp/interpolation/McpPlaceholderResolver.ts`
- [x] T018 [US2] Implement runtime env composer merging `.env` and server `env` in `src/infrastructure/features/mcp/loaders/McpServerEnvComposer.ts`
- [x] T019 [US2] Integrate interpolation and env composition into MCP aggregation pipeline in `src/infrastructure/features/mcp/loaders/McpServerAggregator.ts`
- [x] T020 [US2] Ensure resolved env payload is passed through apply integration boundary in `src/core/application/features/apply/commands/ApplyCommand.ts`

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Fail Invalid Files, Keep Valid Files (Priority: P3)

**Goal**: Enforce validation and error reporting so invalid files/entries fail while valid ones continue loading.

**Independent Test**: Run with mixed valid/invalid files and verify valid entries load while failures are isolated with actionable reasons.

- [x] T021 [P] [US3] Implement MCP entry schema validator (`command`, `args`, `env`) in `src/infrastructure/features/mcp/validators/McpServerEntryValidator.ts`
- [x] T022 [P] [US3] Implement unresolved placeholder validator in `src/infrastructure/features/mcp/validators/McpPlaceholderValidation.ts`
- [x] T023 [US3] Implement per-file/per-entry failure isolation in `src/infrastructure/features/mcp/loaders/McpServerAggregator.ts`
- [x] T024 [US3] Implement sanitized MCP error mapping and message codes in `src/infrastructure/features/mcp/reporting/McpErrorFormatter.ts`
- [x] T025 [US3] Implement MCP load report emission contract in `src/infrastructure/features/mcp/reporting/McpLoadReportBuilder.ts`
- [x] T026 [US3] Update CLI apply output to show loaded/skipped/failed summaries without secrets in `src/presentation/cli/features/apply/commands/apply.ts`
- [x] T027 [US3] Enforce duplicate `mcpServers` key conflict policy (reject impacted entries, no override) in `src/infrastructure/features/mcp/validators/McpServerConflictValidator.ts`

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate end-to-end behavior, docs alignment, and quality gates.

- [x] T028 [P] Add contract tests for MCP config and load report behavior in `tests/contract/mcp/McpContracts.test.ts`
- [x] T029 [P] Add integration tests for mixed-validity loading and interpolation in `tests/integration/mcp/McpApplyFlow.test.ts`
- [x] T030 [P] Add unit tests for MCP parser and discovery in `tests/unit/infrastructure/Features/mcp/McpParserAndDiscovery.test.ts`
- [x] T031 [P] Add unit tests for MCP interpolation and env composition in `tests/unit/infrastructure/Features/mcp/McpInterpolationAndEnv.test.ts`
- [x] T032 [P] Add performance validation test for 100 files / 95% under 10s in `tests/integration/mcp/McpPerformance.test.ts`
- [x] T033 [P] Add secret-redaction assertions for CLI/report output in `tests/integration/mcp/McpSecurityRedaction.test.ts`
- [x] T034 Run and fix `bun test` for MCP scope in `tests`
- [x] T035 Run and fix `bun run lint` and `bun run type-check` for MCP scope in `src`
- [x] T036 Validate quickstart scenario against implementation and update if needed in `specs/002-manage-mcp-configs/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): start immediately.
- Phase 2 (Foundational): depends on Phase 1 and blocks all user stories.
- Phase 3 (US1): depends on Phase 2.
- Phase 4 (US2): depends on Phase 2 and integrates with shared MCP pipeline.
- Phase 5 (US3): depends on Phase 2 and integrates with shared MCP pipeline.
- Phase 6 (Polish): depends on completion of desired user stories.

### User Story Dependencies

- US1 (P1): no dependency on other user stories; defines MVP.
- US2 (P2): independently implementable/testable after Foundational phase.
- US3 (P3): independently implementable/testable after Foundational phase.

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T009 [US1] Implement deterministic MCP file discovery in src/infrastructure/features/mcp/loaders/McpFileDiscovery.ts"
Task: "T010 [US1] Implement mcpServers JSON parser in src/infrastructure/features/mcp/parsers/McpServersParser.ts"
```

### User Story 2

```bash
Task: "T015 [US2] Implement .env loader in src/infrastructure/features/mcp/loaders/McpEnvFileLoader.ts"
Task: "T016 [US2] Implement interpolation scanner in src/infrastructure/features/mcp/interpolation/McpInterpolationScanner.ts"
```

### User Story 3

```bash
Task: "T021 [US3] Implement MCP entry schema validator in src/infrastructure/features/mcp/validators/McpServerEntryValidator.ts"
Task: "T027 [US3] Enforce duplicate mcpServers key conflict policy in src/infrastructure/features/mcp/validators/McpServerConflictValidator.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1).
3. Validate independent test for US1 before expanding scope.

### Incremental Delivery

1. Deliver US1 (discovery + parsing + load).
2. Deliver US2 (env loading + interpolation + env injection).
3. Deliver US3 (validation isolation + sanitized reporting).
4. Complete Phase 6 quality and documentation checks.

### Suggested MVP Scope

- US1 only (Phase 3) after foundational setup.
