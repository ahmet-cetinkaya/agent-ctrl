# Quickstart: Cross-Platform Model Frontmatter

Özelliğin uçtan uca doğrulama senaryoları. Önce birim/bütünleştirme testleri, sonra elle uçtan uca kontrol.

## Ön koşullar

- Bun kurulu; repo kökünde `bun install` yapılmış.
- Test izole ortamı için `AGENT_CTRL_*` home override'ları veya geçici config kökleri kullanılabilir (mevcut test yardımcılarına bakınız).

## Senaryo 1 — Otomatik test takımı (birincil doğrulama)

```bash
bun test tests/unit/core/domain/shared/modelFrontmatter
bun test tests/unit/infrastructure/features/apply/adapters/FrontmatterModelTransformer.test.ts
bun test tests/unit/infrastructure/features/apply/adapters/PlatformSyncUtils.test.ts
bun test tests/integration/apply
```

**Beklenen**: Resolver öncelik/dönüşüm/düşürme senaryoları, transformer koruma kuralları ve platform sync entegrasyonu geçer; mevcut renderer testleri değişmeden geçer.

## Senaryo 2 — Claude'da önek kırpma (elle)

1. `~/.agent-ctrl/commands/model-test.md` oluştur:

   ```markdown
   ---
   description: Model frontmatter smoke test
   model: anthropic/claude-sonnet-4-5
   models:
     qwen: fast
   ---

   Smoke test body.
   ```

2. `bun run dev apply claude`
3. `~/.claude/commands/model-test.md` içeriğini incele.

**Beklenen**: `model: claude-sonnet-4-5` yazar; `models` haritası yoktur; body ve diğer frontmatter alanları korunur.

## Senaryo 3 — OpenCode'ta birebir geçirme (elle)

`bun run dev apply opencode` → OpenCode komut dosyasında `model: anthropic/claude-sonnet-4-5` aynen yazar; `models` yoktur.

## Senaryo 4 — Desteklenmeyen platformda uyarıyla düşürme (elle)

`bun run dev apply gemini` → komut TOML'inde model bilgisi yoktur; komut çıktısındaki uyarı listesinde gerekçe görünür.

## Senaryo 5 — Override önceliği (elle)

1. `~/.agent-ctrl/agents/model-agent.md` oluştur (`model: anthropic/claude-sonnet-4-5` + `models: { qwen: fast }`).
2. `bun run dev apply qwen` → agent çıktısında `model: fast` yazar.
3. `bun run dev apply opencode` → agent çıktısında `model: anthropic/claude-sonnet-4-5` yazar (override yalnız qwen'i etkiler).

## Senaryo 6 — ForgeCode bölme ve Codex TOML (elle)

- `bun run dev apply forgecode` → agent dosyasında `model: claude-sonnet-4-5` VE `provider: anthropic` ayrı alanlar.
- `bun run dev apply codex` → agent TOML dosyasında `model = "anthropic/claude-sonnet-4-5"` satırı.

## Senaryo 7 — Geriye uyumluluk

`model`/`models` içermeyen mevcut bir projede `apply` çıktıları özellik öncesi ile aynı içerikte olmalı (SC-003); mevcut test paketi de bunu korur.

## Son kontrol

```bash
bun test
bunx tsc --noEmit   # type-check script'i mevcutsa: bun run type-check
```
