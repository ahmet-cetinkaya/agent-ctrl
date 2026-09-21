# Implementation Plan: Cross-Platform Model Frontmatter

**Branch**: `007-cross-platform-model-frontmatter` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-cross-platform-model-frontmatter/spec.md`

## Summary

Bu özellik, command/agent/skill artifact'lerinin frontmatter'ına kanonik bir `model` alanı (`provider/model-id` biçimi) ve opsiyonel per-platform `models:` override haritası ekler. `apply` sırasında değer, hedef platforma göre kural bazlı dönüştürülür: OpenCode/Kilo/Codex-agent aynen geçer, Claude'da `provider/` öneki kırpılır, ForgeCode agent'larında `model`+`provider` olarak bölünür, Qwen agent'ları gibi kısıtlı sözlüklü platformlarda yalnızca açık override kabul edilir, desteklenmeyen yüzeylerde alan uyarıyla düşürülür. Model kimliği listesi/eşleme tablosu BULUNMAZ — yalnızca format kuralları vardır (yeni model çıkışı kod değişikliği gerektirmez, SC-004).

Teknik yaklaşım üç katmanlıdır: (1) saf core çözümleyici + bildirsel capability matrisi, (2) YAML frontmatter dönüştürücüsü, (3) `PlatformSyncUtils` plumbing'i. **Kilit tasarım kararı:** mevcut renderer'lar bilinmeyen frontmatter satırlarını koruduğundan, dönüşüm renderer'lardan ÖNCE kaynak metin üzerinde yapılır — hiçbir renderer imzası değişmez.

## Technical Context

**Language/Version**: TypeScript strict mode, Bun runtime
**Primary Dependencies**: `yaml` (zaten bağımlık; `parseDocument` pattern'i `OpenCodeAgentRenderer.ts`'te mevcut), mevcut adapter/renderer mimarisi, Commander.js (değişmiyor)
**Storage**: Dosya tabanlı (artifact markdown dosyaları → platform config dosyaları)
**Testing**: Bun test (`describe`/`it`, inline fixture'lar); unit (`tests/unit/`), integration (`tests/integration/apply/`), contract (`tests/contract/`)
**Target Platform**: Cross-platform CLI (Linux, macOS, Windows)
**Project Type**: CLI tool
**Performance Goals**: Apply süresinde kayda değer artış yok; dönüşüm artifact başına tek YAML parse (yalnızca `model`/`models` içeren dosyalarda)
**Constraints**: %100 geriye uyumluluk (SC-003: `model`/`models` içermeyen çıktılar içerik olarak değişmez); renderer imzaları değişmez; core dış bağımlılık almaz
**Scale/Scope**: 10 platform × 3 artifact türü capability matrisi; 9 adaptör + ClaudeAdapter yolu

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Layered Architecture Boundaries (I)

✅ **PASS**: Capability matrisi ve çözümleyici core'da (`src/core/domain/shared/modelFrontmatter/`), YAML dönüşümü infrastructure'da (`FrontmatterModelTransformer`), plumbing mevcut `PlatformSyncUtils`/adaptörlerde. Yön: infrastructure → core. Core dış bağımlılık (yaml paketi) almaz.

### Deterministic Configuration Behavior (II)

✅ **PASS**: Aynı frontmatter + platform → her zaman aynı çıktı (bildirsel matris, saf fonksiyonlar). Düşürme gibi "çatışmalar" açık uyarı üretir (FR-004/005/007). Bozuk YAML izole edilir: artifact atlanır, apply devam eder (FR-008).

### Test and Type Safety Gates (III)

✅ **PASS**: Unit (resolver, transformer), integration (apply yolları), mevcut renderer testleri dokunulmadan geçmeli (regresyon kanıtı). TypeScript strict korunur. Teslim `bun test` + type-check geçmeli.

### Security and Secret Handling (IV)

✅ **PASS**: Model kimlikleri gizli değil; uyarılar dosya/ad alanı içerir. Yeni dosya yazma/silme yüzeyi eklenmez (mevcut sync helper'lar yazıyor zaten).

### CLI Observability and Usability (V)

✅ **PASS**: Uyarılar mevcut `ApplyIntegrationResult.warnings` akışına girer (FR-010). README güncellenir (FR-011).

### Backward Compatibility

✅ **PASS**: SC-003 açık gereksinim; `FileSyncResult.warnings` opsiyonel alanla geriye uyumlu.

## Project Structure

### Documentation (this feature)

```text
specs/007-cross-platform-model-frontmatter/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── model-frontmatter.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── core/
│   └── domain/
│       └── shared/
│           ├── types/
│           │   └── SupportedApplyPlatform.ts        # MEVCUT — matris bu tipi kullanır
│           └── modelFrontmatter/                    # YENİ
│               ├── types.ts                         # ModelTransform, ArtifactKind, ModelResolution
│               ├── ModelCapabilityMatrix.ts         # platform × artifact türü bildirsel tablo
│               ├── ModelFrontmatterResolver.ts      # öncelik + doğrulama (saf)
│               └── index.ts
├── infrastructure/
│   └── features/
│       ├── apply/adapters/
│       │   ├── PlatformSyncUtils.ts                 # DEĞİŞİR: FileSyncResult.warnings, platform parametresi, transformer entegrasyonu
│       │   └── FrontmatterModelTransformer.ts       # YENİ: applyModelFrontmatter(source, platform, kind)
│       ├── claude/adapters/
│       │   ├── ClaudeAdapter.ts                     # DEĞİŞİR: syncCommands/syncAgents transformer sarmalı
│       │   └── ClaudeApplyAdapter.ts                # DEĞİŞİR: uyarı toplayıcısını result'a taşır
│       ├── opencode/adapters/OpenCodeAdapter.ts     # DEĞİŞİR (~5 satır)
│       ├── forgecode/adapters/ForgeCodeAdapter.ts   # DEĞİŞİR (~5 satır)
│       ├── gemini/adapters/GeminiAdapter.ts         # DEĞİŞİR (~5 satır)
│       ├── cursor/adapters/CursorAdapter.ts         # DEĞİŞİR (~5 satır)
│       ├── windsurf/adapters/WindsurfAdapter.ts     # DEĞİŞİR (~5 satır)
│       ├── kilo/adapters/KiloAdapter.ts             # DEĞİŞİR (~5 satır)
│       ├── qwen/adapters/QwenAdapter.ts             # DEĞİŞİR (~5 satır)
│       ├── codex/adapters/CodexAdapter.ts           # DEĞİŞİR (~5 satır)
│       └── antigravity/adapters/AntigravityAdapter.ts # DEĞİŞİR (~5 satır)

tests/
├── unit/
│   ├── core/domain/shared/modelFrontmatter/         # YENİ: resolver testleri
│   └── infrastructure/features/apply/adapters/
│       ├── FrontmatterModelTransformer.test.ts      # YENİ
│       └── PlatformSyncUtils.test.ts                # GENİŞLETİLİR
└── integration/apply/                               # GENİŞLETİLİR
```

**Structure Decision**: Tek CLI projesi yapısı korunur. Saf çözümleme core'da, YAML'e dokunan kod infrastructure'da — anayasal katman sınırına birebir uyum. Renderer sınıfları (`OpenCodeCommandRenderer` vb.) bilinçli olarak değiştirilmez.

## Complexity Tracking

> **No constitutional violations — this section not applicable**
