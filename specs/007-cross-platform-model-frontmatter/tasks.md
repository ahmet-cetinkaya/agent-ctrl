# Tasks: Cross-Platform Model Frontmatter

**Input**: Design documents from `/specs/007-cross-platform-model-frontmatter/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Spec, test taskları açıkça gerektiriyor (SC-005) — dahil edilmiştir.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root (bkz. plan.md proje yapısı)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Yeni core modülünün iskeleti

- [x] T001 Create directory `src/core/domain/shared/modelFrontmatter/` with empty `types.ts`, `ModelCapabilityMatrix.ts`, `ModelFrontmatterResolver.ts`, `index.ts` files per plan.md project structure
- [x] T002 [P] Create test directory `tests/unit/core/domain/shared/modelFrontmatter/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Saf core çözümleme katmanı ve YAML transformer — tüm user story'ler buna dayanır

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Define shared types in `src/core/domain/shared/modelFrontmatter/types.ts`: `ModelTransform` (`passthrough` | `prefix-strip` | `split`), `ArtifactKind` (`command` | `agent` | `skill`), `ModelCapability` (`support: set|drop`, `transform`, `requiresOverride`), `ModelResolution` (`action: absent|set|drop`, `value?`, `provider?`, `warnings`) per data-model.md
- [x] T004 Implement declarative `ModelCapabilityMatrix` in `src/core/domain/shared/modelFrontmatter/ModelCapabilityMatrix.ts`: `Record<SupportedApplyPlatform, {commands, agents, skills}>` with the researched table (claude: prefix-strip+set everywhere; opencode: passthrough commands/agents, drop skills; kilo: drop commands/skills, passthrough agents; forgecode: drop commands/skills, split agents; qwen: drop commands/skills, agents `requiresOverride`; codex: drop commands/skills, passthrough agents (TOML); cursor/gemini/windsurf/antigravity: drop all). Use `SUPPORTED_APPLY_PLATFORMS` from `src/core/domain/shared/types/SupportedApplyPlatform.ts`. Must contain no model ID strings.
- [x] T005 Implement `ModelFrontmatterResolver` in `src/core/domain/shared/modelFrontmatter/ModelFrontmatterResolver.ts`: pure `resolveModelFrontmatter({model?, models?, platform, artifactKind}) → ModelResolution` with precedence `models[platform] > model > absent`; prefix-strip removes `provider/` prefix only when present (bare values like `inherit`/`sonnet` unchanged); split produces `value` + `provider`; `requiresOverride` + only canonical `model` → `drop` + override-required warning; unknown `models:` keys (not in `SUPPORTED_APPLY_PLATFORMS`) → warning, ignored; non-string `models:` values → warning, ignored; override for a `drop` capability → warning, dropped; no fields → `absent`, zero warnings per spec.md FR-001..FR-009 and contracts/model-frontmatter.md
- [x] T006 Export public API from barrel `src/core/domain/shared/modelFrontmatter/index.ts`
- [x] T007 Unit tests for resolver in `tests/unit/core/domain/shared/modelFrontmatter/ModelFrontmatterResolver.test.ts`: precedence (override beats canonical); claude prefix-strip (`anthropic/claude-sonnet-4-5` → `claude-sonnet-4-5`; `inherit`/`sonnet` unchanged); forgecode agent split (`value` + `provider`); qwen agents (canonical → drop + warning; `models.qwen: fast` → set); unknown `models.zzz` → warning; override for drop target (`models.windsurf`) → warning + drop; absent → no warnings; non-string override value → warning
- [x] T008 Implement `applyModelFrontmatter(source, platform, artifactKind) → {content, warnings}` in `src/infrastructure/features/apply/adapters/FrontmatterModelTransformer.ts` using `yaml` package `parseDocument` and the `FRONTMATTER_PATTERN` pattern from `OpenCodeAgentRenderer.ts`: no frontmatter → unchanged, no warnings; YAML parse errors → unchanged + warning; set → write transformed `model` (+ `provider` for split); drop → remove `model`; ALWAYS delete the `models` key; all other frontmatter fields and body preserved (FR-006, FR-008, FR-009)
- [x] T009 Unit tests for transformer in `tests/unit/infrastructure/features/apply/adapters/FrontmatterModelTransformer.test.ts`: unrelated keys preserved; `models` always removed; malformed YAML → unchanged + warning; no frontmatter → unchanged; drop case removes `model` + warning; split writes both fields

**Checkpoint**: Core resolver + transformer hazır; user story'ler başlayabilir

---

## Phase 3: User Story 1 - Tek yerde model belirle, her yerde çalışsın (Priority: P1) 🎯 MVP

**Goal**: `model` alanı, destekleyen platformlarda doğru biçimde yazılır (claude strip, opencode/kilo/codex passthrough, forgecode split)

**Independent Test**: `model` içeren command/agent ile apply → hedef dosyada model doğru biçimde (bkz. quickstart.md Senaryo 2, 3, 6)

### Implementation for User Story 1

- [x] T010 Add `warnings: string[]` field to `FileSyncResult` in `src/infrastructure/features/apply/adapters/PlatformSyncUtils.ts`, defaulting to `[]` in `syncRenderedFiles` (backward compatible) per plan.md plumbing
- [x] T011 Add leading `platform: SupportedApplyPlatform` parameter to markdown sync helpers in `src/infrastructure/features/apply/adapters/PlatformSyncUtils.ts` and run `applyModelFrontmatter` on source before rendering: `syncCommandsAsMarkdown` (kind `command`), `syncCommandsAsMarkdownFlattened` (kind `command`), `syncAgentsAsMarkdown` (kind `agent`); collect warnings into `FileSyncResult.warnings`
- [x] T012 Special cases in `src/infrastructure/features/apply/adapters/PlatformSyncUtils.ts`: `syncAgentsAsCodexToml`/`buildCodexAgentToml` resolve model from source frontmatter and emit TOML `model = "<value>"` line after `description` when action is `set` (codex agents are passthrough), collecting warnings; forgecode agent split emits both `model:` and `provider:` lines
- [x] T013 Wire `platformName` into sync calls and aggregate `result.warnings` into `ApplyIntegrationResult.warnings` in `src/infrastructure/features/opencode/adapters/OpenCodeAdapter.ts` and `src/infrastructure/features/kilo/adapters/KiloAdapter.ts` and `src/infrastructure/features/forgecode/adapters/ForgeCodeAdapter.ts` and `src/infrastructure/features/codex/adapters/CodexAdapter.ts` (pattern: `warnings: [...source.warnings, ...syncWarnings]`)
- [x] T014 Claude path (bypasses PlatformSyncUtils): in `src/infrastructure/features/claude/adapters/ClaudeAdapter.ts` wrap command source with `applyModelFrontmatter(source, "claude", "command")` in `syncCommands` (~line 271) and agent source with kind `"agent"` in `syncAgents` (~line 243); add warnings collector (e.g., constructor-injected array); propagate to result in `src/infrastructure/features/claude/adapters/ClaudeApplyAdapter.ts`
- [x] T015 Extend `tests/unit/infrastructure/features/apply/adapters/PlatformSyncUtils.test.ts`: codex agent TOML gains `model = "..."`; `syncCommandsAsMarkdown` opencode passthrough keeps full value; forgecode `syncAgentsAsMarkdown` yields `model: claude-x` + `provider: anthropic`; warnings returned
- [x] T016 Integration tests in `tests/integration/apply/`: fixture command+agent with `model: anthropic/claude-sonnet-4-5` → claude command file contains `model: claude-sonnet-4-5`; opencode file contains full value; forgecode agent contains split fields; codex agent TOML contains `model = "anthropic/claude-sonnet-4-5"` (quickstart.md Senaryo 2/3/6)

**Checkpoint**: US1 tek başına çalışır — model destekleyen platformlarda doğru biçimde yazılır

---

## Phase 4: User Story 2 - Platform modeli desteklemiyorsa uyar (Priority: P1)

**Goal**: Desteklenmeyen yüzeylerde `model` düşer + gerekçeli uyarı; `models` asla hedefe yazılmaz

**Independent Test**: `model` içeren command ile gemini/windsurf/cursor apply → çıktıda model yok, uyarı listesinde gerekçe var (bkz. quickstart.md Senaryo 4)

### Implementation for User Story 2

- [x] T017 Wire `platformName` + warnings aggregation into skill-writing paths in `src/infrastructure/features/apply/adapters/PlatformSyncUtils.ts`: `syncCommandsAsSkills` (kind `skill` — gemini/cursor/qwen/kilo/antigravity/codex drop cell), `syncCommandsAsWorkflows` (kind `command` — windsurf drop), `syncAgentsAsSkills` (kind `skill`), `syncSkills`/`renderSkillMarkdown`/`buildSkillFiles` (kind `skill`; pass platform through) — transformer runs so `model` is dropped with warning on non-claude platforms, `models` never written
- [x] T018 Wire `platformName` + warnings aggregation in `src/infrastructure/features/gemini/adapters/GeminiAdapter.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`, `src/infrastructure/features/antigravity/adapters/AntigravityAdapter.ts`, and qwen skill paths in `src/infrastructure/features/qwen/adapters/QwenAdapter.ts`
- [x] T019 Extend `tests/unit/infrastructure/Features/adapters/ModelFrontmatterPlatformFlow.test.ts`: Gemini command-as-skill strips `model` with one deduplicated warning; `models` key is absent from all checked outputs; Codex only emits TOML `model` from frontmatter
- [x] T020 Adapter-flow coverage in `tests/unit/infrastructure/Features/adapters/ModelFrontmatterPlatformFlow.test.ts`: Gemini apply drops model with warning; artifacts without `model`/`models` produce no model warnings (SC-003); Claude dry-run still surfaces model validation warnings

**Checkpoint**: US1 + US2 birlikte: destekleyen platformlara yazılır, desteklemeyenlerde uyarılı düşürme

---

## Phase 5: User Story 3 - Kısıtlı platformlar için açık override (Priority: P2)

**Goal**: `models.<platform>` override'ı hedef platforma aynen yazılır; genel `model` kısıtlı hedefte uyarıyla düşer

**Independent Test**: `model` + `models: {qwen: fast}` içeren agent → qwen'da `model: fast`, opencode'da genel değer (bkz. quickstart.md Senaryo 5)

### Implementation for User Story 3

- [x] T021 Verify qwen agent path emits override value: qwen agents flow through `syncAgentsAsMarkdown` (kilo renderer per `AgentRendererFactory.ts`); ensure `applyModelFrontmatter` with qwen + `requiresOverride` capability writes `models.qwen` value as `model:` when present (resolver already implements precedence — wire and verify in `src/infrastructure/features/qwen/adapters/QwenAdapter.ts` agent sync; add agent sync if qwen currently lacks one, per plan.md capability matrix qwen agents = set-with-override)
- [x] T022 Unit + integration tests: `tests/unit/infrastructure/features/apply/adapters/PlatformSyncUtils.test.ts` qwen agent with `models.qwen: fast` → `model: fast`; same agent on opencode → `model: anthropic/claude-sonnet-4-5`; integration fixture in `tests/integration/apply/` covering both applies (quickstart.md Senaryo 5)

**Checkpoint**: US3: kısıtlı platformlarda explicit override çalışır

---

## Phase 6: User Story 4 - Geçersiz override kullanımında bilgilendir (Priority: P3)

**Goal**: Bilinmeyen platform anahtarı / drop hedefine override → uyarı, işlem devam eder

**Independent Test**: `models: {zzz: pro}` ile apply → uyarı görünür, diğer artifact'ler uygulanır

### Implementation for User Story 4

- [x] T023 End-to-end verification of resolver warnings through apply: add unit case in `tests/unit/core/domain/shared/modelFrontmatter/ModelFrontmatterResolver.test.ts` (already covered by T007) plus one integration test in `tests/integration/apply/`: artifact with `models: {zzz: pro}` → warning surfaced in result warnings, apply completes, no `models` key in output (spec.md US4 acceptance scenarios)

**Checkpoint**: Tüm user story'ler tamamlanmış ve bağımsız test edilebilir

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T024 [P] Update `README.md`: document `model` and `models` frontmatter fields, the support matrix (from contracts/model-frontmatter.md), override syntax and precedence (FR-011)
- [x] T025 Run full gates: `bun test`, type-check (`bunx tsc --noEmit`), `bun run format`, `bun run lint` — all green (SC-005)
- [x] T026 Run quickstart.md validation scenarios manually (Senaryo 1-7) and record results
- [x] T027 Verify existing renderer tests unchanged and passing (zero renderer modification regression proof)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 (plumbing T010-T012 shared with US1; sequence after US1 to avoid same-file conflicts in PlatformSyncUtils.ts)
- **Phase 5 (US3)**: Depends on Phase 2 (resolver T005 provides precedence); after US1 for adapter wiring
- **Phase 6 (US4)**: Depends on Phase 2 only (resolver warnings)
- **Polish (Phase 7)**: After all stories

### User Story Dependencies

- **US1 (P1)**: After Foundational. MVP.
- **US2 (P1)**: After Foundational; shares PlatformSyncUtils plumbing with US1 — implement sequentially (T017 after T011-T012 merged).
- **US3 (P2)**: After Foundational; depends on US1's adapter wiring pattern for qwen agent path.
- **US4 (P3)**: After Foundational only; resolver-level behavior already built in T005.

### Within Each User Story

- Core/plumbing before adapter wiring; unit tests before integration tests
- Same-file tasks (PlatformSyncUtils.ts) must be sequential

### Parallel Opportunities

- T002 ∥ T003-T006 (different files)
- T004 ∥ T005 (different files, both depend on T003 types) — sonra T006
- T007 ∥ T008 ∥ T009 (test file, transformer, transformer test — different files)
- T013 (4 adapters) ∥ T014 (claude files) within US1
- T018's five adapters are independent of each other
- T024 ∥ T025-T027 in Polish

---

## Parallel Example: User Story 1

```bash
# After Phase 2 checkpoint, launch together:
Task: T013 — wire opencode/kilo/forgecode/codex adapters
Task: T014 — claude adapter path

# Then tests:
Task: T015 — PlatformSyncUtils unit extensions
Task: T016 — integration fixtures
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: US1
4. **STOP and VALIDATE**: quickstart.md Senaryo 2/3/6
5. Ship if desired

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. +US1 → validate (MVP!)
3. +US2 → validate (Senaryo 4)
4. +US3 → validate (Senaryo 5)
5. +US4 → validate; Polish: docs + gates + quickstart

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Same-file constraint: PlatformSyncUtils.ts tasks (T010-T012, T017) MUST run sequentially
- Renderer classes are intentionally NOT modified — transformer runs before rendering (research.md Decision 4)
- Verify new tests fail before implementing where TDD ordering applies (T007, T009 before/with T005, T008)
