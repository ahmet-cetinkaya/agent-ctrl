# Research: Cross-Platform Model Frontmatter

## Decision 1: Kanonik model biçimi `provider/model-id`

- **Decision**: Ortak `model` değeri serbest dize `provider/model-id` olur; araç hiçbir model adı/sürümü sözlüğü tutmaz.
- **Rationale**: OpenCode ve Kilo'nun native biçimi bu; Qwen/Cursor/Codex tam ID kabul eder. Yeni model sürümü yayımlandığında agent-ctrl güncellemesi gerekmez (SC-004).
- **Alternatives considered**:
  - `sonnet`/`opus`/`haiku` alias'ları: Claude'a uygun ama diğer sağlayıcılar için belirsiz.
  - Model ailelerini platform takma adlarına eşleme: her yeni modelle bakım ve yanlış modele sessiz düşme riski yaratır; reddedildi.

## Decision 2: Kural bazlı capability matrisi

- **Decision**: Platform × artifact-kind (`command`/`agent`/`skill`) için bildirsel bir capability matrisi tanımlanır. Her hücre `set`/`drop` ve gerekiyorsa dönüşüm (`passthrough`/`prefix-strip`/`split`) belirtir.
- **Rationale**: Platform davranışı tek kaynakta görünür; adapter'lara dağılmış koşulların önüne geçer. Model ID listesi içermez.
- **Alternatives considered**:
  - Her renderer/adaptörde ayrı koşul: platform sayısı arttıkça tekrarlı ve test edilmesi zor.
  - Raw frontmatter passthrough: desteklenmeyen platformlarda yanlış/etkisiz alanlar bırakır, kullanıcıyı yanıltır.

### Araştırılmış capability tablosu

| Platform    | Command hedefi                   | Agent hedefi          | Skill hedefi | Kural                                                 |
| ----------- | -------------------------------- | --------------------- | ------------ | ----------------------------------------------------- |
| Claude      | set                              | set                   | set          | `provider/` önekini kırp                              |
| OpenCode    | set                              | set                   | drop         | aynen geçir                                           |
| Kilo        | drop (mevcut akış command→skill) | set                   | drop         | agent aynen geçir                                     |
| ForgeCode   | drop                             | set                   | drop         | agent `provider/model` → ayrı alanlar                 |
| Qwen        | drop                             | set (yalnız override) | drop         | canonical değer için uyarı+düşür; `models.qwen` geçer |
| Codex       | drop                             | set (TOML)            | drop         | agent modelini TOML alanına yaz                       |
| Cursor      | drop (command→skill)             | drop (agent→skill)    | drop         | uyarıyla düşür                                        |
| Gemini      | drop                             | unsupported           | drop         | uyarıyla düşür                                        |
| Windsurf    | drop                             | drop (agent→skill)    | drop         | uyarıyla düşür                                        |
| Antigravity | drop (command→skill)             | unsupported           | drop         | uyarıyla düşür                                        |

Kaynaklar (2026-09-21 resmi doküman araştırması): Claude Code Skills/Subagents; OpenCode Commands/Agents; Kilo Workflows/Custom Modes; ForgeCode Commands/Agents; Qwen Code Commands/Subagents; Codex Prompts/Subagents; Gemini CLI Custom Commands; Cursor Subagents; Windsurf Workflows; Antigravity Subagents.

## Decision 3: `models:` explicit override, tahmin yok

- **Decision**: Kullanıcı per-platform değer vermek için `models: { qwen: fast }` kullanır. Öncelik `models.<platform>` > `model` > absent. Override yalnız o platform apply edilirken kullanılır; `models` asla hedefe yazılmaz.
- **Rationale**: Antigravity/Qwen gibi kısıtlı değer setlerine genel modelden tahminsel eşleme, hatalı modele sessiz yönlendirme yaratır.
- **Alternatives considered**:
  - Sonnet→pro gibi varsayılan eşleme: bakım yükü ve yanlış sonuç riski nedeniyle reddedildi.
  - Her platform için ayrı frontmatter alanı (`qwen-model` vb.): ölçeklenmez, kaynak artifact okunabilirliğini bozar.

## Decision 4: Renderer değil, sync öncesi dönüşüm

- **Decision**: `FrontmatterModelTransformer`, kaynak markdown'ı renderer çağrısından önce dönüştürür. `ICommandRenderer` / `IAgentRenderer` imzaları değişmez.
- **Rationale**: `OpenCodeCommandRenderer`, `ForgeCodeCommandRenderer` ve `ForgeCodeAgentRenderer` mevcut bilinmeyen frontmatter alanlarını korur; `OpenCodeAgentRenderer` zaten YAML parse pattern'ini kullanır. Tek transformer, tüm sync yollarında tutarlı davranış sağlar.
- **Alternatives considered**:
  - Her renderer'da model işle: tekrarlı değişiklik ve yüksek regresyon riski.
  - Renderer sonuçlarından warning diff'i çıkar: model alanını dönüştürmek/split etmek için platform bağlamı ve YAML semantiği eksik.

## Decision 5: Uyarıları mevcut result akışından taşı

- **Decision**: `FileSyncResult` bir `warnings` listesi taşır. Adapter'lar bunu `ApplyIntegrationResult.warnings` ile birleştirir; CLI'nin mevcut `LogService` yolu aynen kullanılır.
- **Rationale**: Yeni CLI yüzeyi veya hata kanalı eklemeden FR-010'u karşılar; JSON sonuçları da warnings'i zaten taşıyabilir.
- **Alternatives considered**:
  - Renderer return tipini genişletme: her renderer/factory/testi etkiler; gereksiz geniş etki alanı.
  - Console'a transformer içinden doğrudan yazma: presentation katmanı ihlali.

## Decision 6: YAML parse hatası fail-soft

- **Decision**: Frontmatter parse edilemiyorsa transformer içerik üzerinde değişiklik yapmaz; uyarı ekler ve artifact sync'e devam eder.
- **Rationale**: Anayasa II: geçerli artifact'ler işlemeye devam eder; mevcut kullanıcı içeriği bozulmaz (FR-008).
- **Alternatives considered**:
  - Apply'ı tamamen başarısız kılma: ilgisiz artifact'leri de engeller.
  - Bozuk YAML'i otomatik düzeltme: kullanıcı içeriğini tahminsel olarak değiştirmek risklidir.
