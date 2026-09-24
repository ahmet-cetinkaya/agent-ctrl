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

## Phase 9: User Story 6 - `pi-mcp-adapter` kuruluysa MCP sunucuları fiilen uygulansın (Priority: P2)

**Goal**: `pi-mcp-adapter` topluluk eklentisi tespit edildiğinde MCP sunucularını `.mcp.json`/`<userRoot>/mcp.json`'a fiilen yazmak; tespit edilmediğinde Phase 6'daki fallback'i değiştirmeden korumak.

**Independent Test**: `.pi/settings.json`'da eklenti bildirilmiş bir projede `apply pi` → `.mcp.json` doğru biçimde yazılır, uyarı görünmez (bkz. quickstart.md Senaryo 6)

**Not**: Bu faz, kullanıcının açık talebiyle (2026-09-23) sonradan eklendi — bkz. `research.md` Karar 9.

### Implementation for User Story 6

- [x] T023 Create `PiMcpConfigRenderer` (`IMcpConfigRenderer`) in `src/infrastructure/features/apply/adapters/PiMcpConfigRenderer.ts`: identical `{ mcpServers: {...} }` shape to `ForgeCodeMcpConfigRenderer`; register `["pi", new PiMcpConfigRenderer()]` in `McpConfigRendererFactory.ts`; add `renderPiMcpConfig()` convenience wrapper in `PlatformSyncUtils.ts` (mirroring `renderForgeCodeMcpConfig`)
- [x] T024 Implement `PiAdapter.isPackageInstalled(packageName, projectPath, userRoot, targetScope)` + private `settingsDeclaresPackage()`: reads `.pi/settings.json` (project) and/or `<userRoot>/settings.json` (personal — always checked; project scope checks both, user scope checks only the user file), parses `packages[].source`, matches `"npm:<name>"` or `"npm:<name>@<version>"`; returns `false` (never throws) on missing file/malformed JSON/non-array `packages`
- [x] T025 Wire the detection into the MCP block of `PiAdapter.applyApplyIntegration()`: if `isPackageInstalled("pi-mcp-adapter", ...)` → `mergeJsonObjectFile(mcpConfigPath, (existing) => renderPiMcpConfig(existing, source.mcpServers), dryRun)` where `mcpConfigPath` is `.mcp.json` (project) / `resolve(userRoot, "mcp.json")` (user); else → existing Phase 6 warning unchanged. Update `message` to append `"(via pi-mcp-adapter)"` when applied via the plugin
- [x] T026 [P] Unit tests in `PiAdapter.test.ts` (`describe("pi-mcp-adapter plugin detection")`): project-declared plugin → applied to `.mcp.json`; personally-declared plugin (`<userRoot>/settings.json`) detected in project scope; unrelated package declared → fallback warning; malformed JSON → fallback warning, no throw
- [x] T027 [P] Update `docs/platforms/PI.md` ("Community Extensions for Missing Surfaces") and `README.md` if needed to document the detection-aware MCP behavior and its file-based, best-effort limitation
- [x] T028 Re-run full gates: `bun test` (1047 pass), `bunx tsc --noEmit`, `scripts/lint.sh` — all green; manual isolated (`AGENT_CTRL_HOME`) CLI verification of both the detected and not-detected paths

**Checkpoint**: US6 bağımsız çalışır ve US1-US5'i regresyona uğratmaz

---

## Phase 10: User Story 7 - `pi-subagents` kuruluysa agent'lar native olarak uygulansın (Priority: P2)

**Goal**: `pi-subagents` topluluk eklentisi tespit edildiğinde agent'ları `.pi/agents/*.md`'ye fiilen yazmak; tespit edilmediğinde Phase 6'daki skill-dönüştürme fallback'ini değiştirmeden korumak. Phase 9 (MCP) ile aynı desen, farklı paket/hedef.

**Independent Test**: `.pi/settings.json`'da eklenti bildirilmiş bir projede `apply pi` → `.pi/agents/<id>.md` doğru biçimde yazılır, "Agents are being written as skills instead" uyarısı görünmez (bkz. quickstart.md Senaryo 7)

**Not**: Bu faz, kullanıcının "agent (behavior prompt) ile subagent aynı şey mi?" sorusunu netleştirdikten sonra açık talebiyle (2026-09-24) eklendi — bkz. `research.md` Karar 10.

### Implementation for User Story 7

- [x] T029 Create `PiAgentRenderer` (`IAgentRenderer`) in `src/infrastructure/features/apply/adapters/PiAgentRenderer.ts`: injects `name` (always corrected to the true agent id) + `description` (only when missing — an existing user-authored description is never overwritten) frontmatter, preserving every other field (`tools`, `model`, `systemPromptMode`, ...) verbatim; handles existing/missing/malformed (missing opening `---`) frontmatter the same way `PiCommandRenderer` does. Register `pi: new PiAgentRenderer()` in `AgentRendererFactory.ts`
- [x] T030 [P] Unit tests in `tests/unit/infrastructure/features/apply/adapters/PiAgentRenderer.test.ts` (mirrors `OpenCodeAgentRenderer.test.ts` convention): no-frontmatter case, name-update-preserves-other-fields (including a precise assertion that an existing `description` is NOT overwritten — a real bug caught during TDD before this task closed), malformed-frontmatter recovery (precise frontmatter/body split assertion, same technique as the earlier `PiCommandRenderer` regression test), fully-malformed fallback, horizontal-rule-in-body non-interference
- [x] T031 Wire the detection into the agents block of `PiAdapter.applyApplyIntegration()`: compute `agentsRoot` (`.pi/agents` project / `<userRoot>/agents` user) alongside `promptsRoot`/`skillsRoot`; if `isPackageInstalled("pi-subagents", ...)` → `syncAgentsAsMarkdown(source.agents, agentsRoot, dryRun, true, this.agentRenderer, "pi")`, no warning; else → existing `syncAgentsAsSkills` fallback unchanged. Add `agentsRoot` to the `--override` cleanup `Promise.all`. Update `message` construction to combine "agents via pi-subagents" and/or "MCP servers via pi-mcp-adapter" when either/both applied
- [x] T032 [P] Unit tests in `PiAdapter.test.ts` (`describe("pi-subagents plugin detection")`): project-declared plugin → applied natively (and NOT also written as a degraded skill); personally-declared plugin detected in project scope; unrelated package → fallback warning; `--override` cleans `.pi/agents/`
- [x] T033 [P] Update `docs/platforms/PI.md` ("Community Extensions for Missing Surfaces") to describe both surfaces as detection-aware with a unified table/explanation
- [x] T034 Re-run full gates: `bun test` (1058 pass), `bunx tsc --noEmit`, `scripts/lint.sh` — all green; manual isolated (`AGENT_CTRL_HOME`) CLI verification with both `pi-subagents` and `pi-mcp-adapter` declared simultaneously

**Checkpoint**: US7 bağımsız çalışır ve US1-US6'yı regresyona uğratmaz

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
