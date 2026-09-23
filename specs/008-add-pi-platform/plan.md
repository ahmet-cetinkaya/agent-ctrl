# Implementation Plan: Pi Platform Support

**Branch**: `008-add-pi-platform` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-add-pi-platform/spec.md`

## Summary

Bu özellik, `agent-ctrl`'in desteklediği apply hedeflerine **Pi** (`@earendil-works/pi-coding-agent`, https://pi.dev) platformunu ekler. Pi; kuralları `AGENTS.md`, skill'leri native `SKILL.md` (Agent Skills spec), komutları `prompts/` altında "prompt template" olarak okur. Pi'de birinci sınıf bir agent/persona dosya biçimi ve native bir MCP yapılandırma yüzeyi olmadığından, bu iki artifact türü mevcut Cursor/Windsurf emsaline göre (agent → skill dönüşümü + uyarı, MCP → uygulanmaz + uyarı) zarifçe düşürülür. Model frontmatter (007 özelliği) capability matrisine tek bir "tümü düşür" satırı eklenir.

Teknik yaklaşım, mevcut 10 platform adaptörünün izlediği aynı üç katmanlı örüntüyü tekrarlar: (1) `SupportedApplyPlatform` union'ına ekleme, (2) `IApplyPlatformAdapter`'ı uygulayan yeni `PiAdapter` + yeni `PiCommandRenderer`, (3) paylaşılan `PlatformSyncUtils` yardımcı fonksiyonlarının (`upsertManagedRuleDocument`, `syncCommandsAsMarkdownFlattened`, `syncSkills`, `syncAgentsAsSkills`) yeniden kullanımı — yeni bir sync yardımcı fonksiyonu veya renderer sözleşmesi eklenmez.

## Technical Context

**Language/Version**: TypeScript strict mode, Bun runtime
**Primary Dependencies**: Mevcut adapter/renderer mimarisi (`PlatformSyncUtils`, `CommandRendererFactory`, `PlatformAdapterRegistry`); yeni dış bağımlılık YOK
**Storage**: Dosya tabanlı (artifact markdown dosyaları → `AGENTS.md` / `prompts/` / `skills/`)
**Testing**: Bun test (`describe`/`it`, `writeApplyFixtures` fixture yardımcı fonksiyonu); unit (`tests/unit/`), contract (`tests/contract/`)
**Target Platform**: Cross-platform CLI (Linux, macOS, Windows)
**Project Type**: CLI tool
**Performance Goals**: Apply süresinde kayda değer artış yok; mevcut 10 platformun apply akışına dokunulmaz
**Constraints**: %100 geriye uyumluluk (mevcut platformların çıktıları değişmez); mevcut renderer/sync sözleşmeleri değişmez; yalnızca ekleme
**Scale/Scope**: 1 yeni platform × 5 artifact türü (rules/commands/skills/agents/mcps) + model capability matrix satırı

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Layered Architecture Boundaries (I)

✅ **PASS**: `PiAdapter` `src/infrastructure/features/pi/adapters/` altında (infrastructure), `core`'daki `IApplyPlatformAdapter` sözleşmesine bağımlı — yön infrastructure → core. `ModelCapabilityMatrix.ts` (core) yalnızca bildirsel bir satır eklenir, dış bağımlılık almaz.

### Deterministic Configuration Behavior (II)

✅ **PASS**: Aynı kaynak artifact seti + `pi` platformu → her zaman aynı çıktı (paylaşılan sync yardımcı fonksiyonları deterministik). Desteklenmeyen yüzeyler (agent, mcp, model) sessizce düşmez — her biri gerekçeli, eyleme geçirilebilir bir uyarı üretir (spec.md FR-005/FR-006/FR-007).

### Test and Type Safety Gates (III)

✅ **PASS**: Yeni `PiAdapter` unit test (proje/kullanıcı kapsamı, override temizliği) + genişletilmiş `PlatformCustomizationSurfaceContract` sözleşme testi. TypeScript strict korunur. `bun test` (1036/1036) + `bunx tsc --noEmit` + `scripts/lint.sh` hatasız geçti.

### Security and Secret Handling (IV)

✅ **PASS**: Yeni gizli değer yüzeyi eklenmez; MCP sunucu tanımları (potansiyel kimlik bilgisi taşıyabilir) Pi'ye hiçbir dosyaya YAZILMAZ — bu, sızıntı riskini artırmak yerine azaltır.

### CLI Observability and Usability (V)

✅ **PASS**: Tüm düşürme davranışları mevcut `ApplyIntegrationResult.warnings` akışına girer. README ve `docs/platforms/PI.md` güncellendi (FR-010).

### Backward Compatibility

✅ **PASS**: Mevcut 10 platformun kodu/çıktısı değişmedi (yalnızca ekleme diff'i: `SupportedApplyPlatform.ts`, `PlatformAdapterRegistry.ts`, `CommandRendererFactory.ts`, `ModelCapabilityMatrix.ts` içine birer satır/entry).

## Project Structure

### Documentation (this feature)

```text
specs/008-add-pi-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── pi-platform.md
└── tasks.md              # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── core/
│   └── domain/
│       └── shared/
│           ├── types/
│           │   └── SupportedApplyPlatform.ts        # DEĞİŞİR: "pi" eklenir
│           └── modelFrontmatter/
│               └── ModelCapabilityMatrix.ts          # DEĞİŞİR: pi satırı eklenir
├── infrastructure/
│   └── features/
│       ├── pi/
│       │   └── adapters/
│       │       ├── PiAdapter.ts                      # YENİ
│       │       └── index.ts                          # YENİ
│       └── apply/adapters/
│           ├── PiCommandRenderer.ts                  # YENİ
│           ├── CommandRendererFactory.ts              # DEĞİŞİR: pi kaydı
│           └── PlatformAdapterRegistry.ts             # DEĞİŞİR: pi factory kaydı

tests/
├── unit/infrastructure/Features/adapters/
│   └── PiAdapter.test.ts                             # YENİ
└── contract/cli/
    └── PlatformCustomizationSurfaceContract.test.ts  # GENİŞLETİLİR

docs/platforms/
└── PI.md                                             # YENİ

README.md                                             # GENİŞLETİLİR (badge, matris, doğrulama listesi)
```

**Structure Decision**: Tek CLI projesi yapısı korunur. Yeni platform, mevcut 10 platformla AYNI dosya/dizin örüntüsünü (`<platform>/adapters/<Platform>Adapter.ts` + paylaşılan `apply/adapters/` renderer'ları) izler — yeni bir mimari katman veya sözleşme eklenmez.

## Complexity Tracking

> **No constitutional violations — this section not applicable**
