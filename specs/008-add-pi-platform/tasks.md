# Tasks: Pi Platform Support

**Input**: Design documents from `/specs/008-add-pi-platform/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Spec, test tasklarını açıkça gerektiriyor (SC-005) — dahil edilmiştir.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root (bkz. plan.md proje yapısı)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Pi'yi kapalı platform union'ına ekleyip registry doğrulamasının onu zorunlu kılmasını sağlamak

- [x] T001 Add `"pi"` to `SUPPORTED_APPLY_PLATFORMS` and `PLATFORM_DISPLAY_NAMES["pi"] = "Pi"` in `src/core/domain/shared/types/SupportedApplyPlatform.ts`
- [x] T002 [P] Create `src/infrastructure/features/pi/adapters/` directory skeleton

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pi'ye özgü komut renderer'ı — tüm user story'ler (özellikle US2) buna dayanır

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 Implement `PiCommandRenderer` (`ICommandRenderer`) in `src/infrastructure/features/apply/adapters/PiCommandRenderer.ts`: `.md` extension, injects `description`-only frontmatter (no `name` field — Pi derives the command name from the filename), preserves existing frontmatter/body when present
- [x] T004 Register `["pi", new PiCommandRenderer()]` in `src/infrastructure/features/apply/adapters/CommandRendererFactory.ts`

**Checkpoint**: Renderer hazır; adapter yazımı başlayabilir

---

## Phase 3: User Story 1 - Kurallarımı Pi'ye tek komutla uygula (Priority: P1) 🎯 MVP

**Goal**: `rules/` → `AGENTS.md` (proje kökü / `~/.pi/agent/`)

**Independent Test**: `apply pi` (project/user) → `AGENTS.md` yönetilen bölümde kuralları içerir (bkz. quickstart.md Senaryo 2, 3)

### Implementation for User Story 1

- [x] T005 Implement `PiAdapter` skeleton in `src/infrastructure/features/pi/adapters/PiAdapter.ts`: `platformName = "pi"`, `resolveTarget()` (project → `<projectPath>/AGENTS.md`, user → `<userRoot ?? ~/.pi/agent>/AGENTS.md`, `surface: "pi-agents-md-prompts-skills"`), static markers `agent-ctrl:pi:start/end`
- [x] T006 Implement rules sync via `upsertManagedRuleDocument(target.configPath, source.rules, PiAdapter.markers, "No managed Pi rules were found.", dryRun)` in `applyApplyIntegration()`
- [x] T007 [P] Create barrel `src/infrastructure/features/pi/adapters/index.ts` exporting `PiAdapter`
- [x] T008 Register `pi: () => new PiAdapter()` in the `factories` record of `src/infrastructure/features/apply/adapters/PlatformAdapterRegistry.ts`

**Checkpoint**: US1 tek başına çalışır — `apply pi` en azından kuralları yazar

---

## Phase 4: User Story 2 - Komutlarım Pi'de prompt template olarak çalışsın (Priority: P1)

**Goal**: `commands/` → `.pi/prompts/` (düzleştirilmiş dosya adı)

**Independent Test**: `apply pi` ile komut içeren proje → `.pi/prompts/<ad>.md` `description` frontmatter'lı üretilir (bkz. quickstart.md Senaryo 2)

### Implementation for User Story 2

- [x] T009 Wire `syncCommandsAsMarkdownFlattened(source.commands, promptsRoot, dryRun, this.commandRenderer, "pi")` into `PiAdapter.applyApplyIntegration()`; aggregate `commandsResult.warnings` into `modelWarnings`
- [x] T010 Extend `PiAdapter.test.ts` (see T017) to assert `.pi/prompts/` directory is created for the fixture command

**Checkpoint**: US1 + US2 birlikte çalışır

---

## Phase 5: User Story 3 - Skill'lerim Pi'de native olarak çalışsın (Priority: P1)

**Goal**: `skills/` → `.pi/skills/` (birebir kopya, native destek)

**Independent Test**: `apply pi` ile skill içeren proje → `.pi/skills/<id>/SKILL.md` bire bir kopyalanır (bkz. quickstart.md Senaryo 2)

### Implementation for User Story 3

- [x] T011 Wire `syncSkills(source.skills, skillsRoot, dryRun, undefined, undefined, "pi")` into `PiAdapter.applyApplyIntegration()`; aggregate warnings

**Checkpoint**: US1 + US2 + US3: MVP tamamlanmış (kurallar, komutlar, skill'ler doğru hedefe yazılıyor)

---

## Phase 6: User Story 4 - Pi'nin desteklemediği yüzeylerde sessiz veri kaybı olmasın (Priority: P2)

**Goal**: agent → skill dönüşümü + uyarı; MCP → uygulanmaz + uyarı

**Independent Test**: agent + mcp içeren proje → `apply pi` sonucunda ikisi için de gerekçeli uyarı, agent skill olarak yazılmış, MCP dosyası yok (bkz. quickstart.md Senaryo 2)

### Implementation for User Story 4

- [x] T012 Wire `syncAgentsAsSkills(source.agents, skillsRoot, dryRun, "pi")` + `source.warnings.push("Pi does not support custom agents. Agents are being written as skills instead.")` when `source.agents.length > 0`
- [x] T013 Push `"Pi does not support MCP server configuration. MCP servers will not be applied."` warning when `source.mcpServers.length > 0` (no file write, no `IMcpConfigRenderer` implementation)
- [x] T014 Implement `--override` cleanup: `rm(promptsRoot)` + `rm(skillsRoot)` (recursive, ENOENT-tolerant) before syncing, mirroring `ForgeCodeAdapter.ts`'s override pattern

**Checkpoint**: US1-US4: tüm artifact türleri Pi için tanımlı davranışa sahip

---

## Phase 7: User Story 5 - Model frontmatter Pi'de güvenle düşürülsün (Priority: P3)

**Goal**: `model`/`models` alanı Pi'nin tüm artifact türlerinde düşer + uyarı

**Independent Test**: `model` içeren command/agent/skill → Pi çıktısında `model` yok, uyarı listesinde gerekçe var (bkz. quickstart.md Senaryo 4)

### Implementation for User Story 5

- [x] T015 Add `pi: { command: drop(), agent: drop(), skill: drop() }` entry to `MODEL_CAPABILITY_MATRIX` in `src/core/domain/shared/modelFrontmatter/ModelCapabilityMatrix.ts` (TypeScript compile error otherwise, since the table type is `Record<SupportedApplyPlatform, ...>`)
- [x] T016 Verify (via T009/T011/T012's existing `platform: "pi"` argument passthrough to `syncCommandsAsMarkdownFlattened`/`syncSkills`/`syncAgentsAsSkills`) that `applyModelFrontmatter` runs and drops `model`/`models` with a warning — no additional wiring needed beyond T015

**Checkpoint**: Tüm user story'ler tamamlanmış ve bağımsız test edilebilir

---

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T017 [P] Unit tests in `tests/unit/infrastructure/Features/adapters/PiAdapter.test.ts`: project-scope full flow (rules/commands/skills/agents/mcp warnings), user-scope target resolution, `--override` cleanup of `.pi/prompts/`
- [x] T018 [P] Extend `tests/contract/cli/PlatformCustomizationSurfaceContract.test.ts` with `pi: { path: resolve(homedir(), ".pi", "agent", "AGENTS.md"), scope: "user" }`
- [x] T019 [P] Update `README.md`: add Pi badge to supported platforms, add Pi row to the model frontmatter support matrix, add `pi` to the `settings/<platform>/` validation list
- [x] T020 [P] Create `docs/platforms/PI.md` documenting Pi's global/project configuration, artifact mapping, and model-frontmatter behavior
- [x] T021 Run full gates: `bun test` (1036 pass), `bunx tsc --noEmit`, `scripts/lint.sh` (TypeScript + ESLint + ShellCheck) — all green
- [x] T022 Run quickstart.md validation scenarios (automated suite) and record results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories (renderer needed by US2's adapter wiring)
- **Phase 3 (US1)**: Depends on Phase 2 (needs `PiAdapter` skeleton, which needs the renderer import wired even if unused until US2)
- **Phase 4 (US2)**: Depends on Phase 3 (same file, `PiAdapter.ts`, sequential)
- **Phase 5 (US3)**: Depends on Phase 3 (same file, sequential)
- **Phase 6 (US4)**: Depends on Phase 3 (same file, sequential)
- **Phase 7 (US5)**: Depends on Phase 2 only (capability matrix is independent of `PiAdapter.ts`); can run in parallel with Phases 3-6
- **Polish (Phase 8)**: After all stories

### Within Each User Story

- All of US1-US4 touch the same file (`PiAdapter.ts`) — implemented sequentially within one file, not literally parallel, despite being independently testable slices
- Tests after implementation for each slice

### Parallel Opportunities

- T002 ∥ T003-T004 (different files)
- T015 (ModelCapabilityMatrix.ts) ∥ T005-T014 (PiAdapter.ts) — different files
- T017 ∥ T018 ∥ T019 ∥ T020 in Polish

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3-5: US1 + US2 + US3 (rules + commands + skills)
4. **STOP and VALIDATE**: quickstart.md Senaryo 2
5. Ship if desired (agents/mcp/model handling would still need Phase 6-7 for full parity with other adapters' "no silent data loss" guarantee)

### Incremental Delivery (as actually executed)

1. Setup + Foundational → renderer ready
2. +US1 → rules to AGENTS.md
3. +US2 → commands to prompts/
4. +US3 → skills to skills/ (MVP complete)
5. +US4 → agents degrade to skills, MCP warns
6. +US5 → model frontmatter drops with warning
7. Polish: tests + docs + gates

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Same-file constraint: `PiAdapter.ts` tasks (T005, T006, T009, T011, T012, T013, T014) MUST run sequentially
- No existing renderer/sync-utility signatures were modified — this feature is purely additive (research.md Decisions 2-7 all reuse existing shared helpers)
- Bu tasks.md, özellik zaten uygulanıp `bun test`/`tsc`/`lint` ile doğrulandıktan SONRA retroaktif olarak yazılmıştır (kullanıcı talebi: "specs güncellenmeli"); tüm task'ler bu nedenle baştan `[x]` işaretlidir
