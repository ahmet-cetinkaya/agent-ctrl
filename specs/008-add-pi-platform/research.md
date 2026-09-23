# Research: Pi Platform Support

## Karar 1 — Hedef araç kimliği

**Karar**: "Pi agent", terminal tabanlı AI coding agent CLI'ı **Pi**'dir (`bin: pi`, paket `@earendil-works/pi-coding-agent`, önceki/mirror scope `@mariozechner/pi-coding-agent`, repo `github.com/earendil-works/pi` — `badlogic/pi-mono`'dan taşınmış, docs `pi.dev`).

**Gerekçe**: Sorgu bağlamında (agent-ctrl'in desteklediği araçlarla aynı kategori — terminal coding agent) tek makul eşleşme budur; başka bir "pi agent" adayı bulunamadı.

**Alternatifler**: Yok — araç ismi kullanıcı tarafından zaten "pi agent" olarak verildi; belirsizlik yalnızca hangi repo/npm scope'un güncel olduğuydu (repo/org 2026'da taşındı).

## Karar 2 — Kural (rules) hedefi: `AGENTS.md`

**Karar**: Proje kapsamında proje kökünde `AGENTS.md`; kullanıcı kapsamında `~/.pi/agent/AGENTS.md`.

**Gerekçe**: Pi resmi dokümantasyonu, `AGENTS.md`/`AGENTS.override.md`'yi (ve Claude Code'un `CLAUDE.md`'sini alias olarak) talimat dosyası olarak okuduğunu belirtiyor. Proje-özel dosya kümesi listesi (`settings.json`, `SYSTEM.md`, `extensions/`, `skills/`, `prompts/`, `themes/`) `AGENTS.md`'yi İÇERMİYOR — bu, `AGENTS.md`'nin (diğer AGENTS.md-ekosistem araçları — Codex, Aider, ForgeCode — gibi) `.pi/` dizini dışında, proje kökünde konvansiyonel olarak okunduğunu gösteriyor. Bu, agent-ctrl'in ForgeCode adaptöründeki (`ForgeCodeAdapter.ts`) aynı örüntüyle birebir tutarlıdır.

**Alternatifler değerlendirildi**: `.pi/AGENTS.md` (proje dizini içine nested) — Pi'nin dosya listesinde `.pi/` altında açıkça sayılmadığı için reddedildi.

## Karar 3 — Komut (commands) hedefi: `prompts/`, düzleştirilmiş, `description`-only frontmatter

**Karar**: `.pi/prompts/<son-segment>.md` (proje) / `<userRoot>/prompts/<son-segment>.md` (kullanıcı); frontmatter yalnızca `description` içerir (Pi'nin `name` alanı yok — komut adı dosya adından türetilir).

**Gerekçe**: Pi dokümantasyonu (`prompt-templates.md`) prompt template'lerin `prompts/` dizininde markdown dosyaları olduğunu, `/isim` olarak çağrıldığını ve frontmatter'ın `description` + opsiyonel `argument-hint` içerdiğini belirtiyor. agent-ctrl'in komut kaynak dosyalarında `argument-hint` karşılığı bir alan yok, bu yüzden yazılmıyor (icat edilmedi). Alt dizin yapısı Pi dokümantasyonunda belgelenmediği için ForgeCode emsaliyle tutarlı biçimde düzleştirildi (`syncCommandsAsMarkdownFlattened`).

**Alternatifler değerlendirildi**: Alt dizin yapısını koruma (`syncCommandsAsMarkdown` + ayraç yok) — Pi'nin `/isim` çağrı biçiminin alt dizin desteklediğine dair belge kanıtı yok; riskten kaçınmak için düzleştirme seçildi.

## Karar 4 — Skill hedefi: native `skills/` kopyası

**Karar**: `.pi/skills/<skill-id>/SKILL.md` (+ varlıklar), mevcut paylaşılan `syncSkills` yardımcı fonksiyonu ile.

**Gerekçe**: Pi, açık Agent Skills spesifikasyonunu (agentskills.io) — Anthropic'in Claude Code'da kullandığı AYNI `SKILL.md` biçimini — native destekliyor. Bu, agent-ctrl'in Windsurf/Cursor/Qwen/Gemini adaptörlerinde zaten kullandığı paylaşılan `syncSkills` çağrı şekliyle bire bir örtüşüyor.

## Karar 5 — Agent (persona) hedefi: skill'e dönüştür + uyarı

**Karar**: Pi'de birinci sınıf bir persona/subagent dosya biçimi YOK (yalnızca extension/skill/prompt-template mekanizmalarıyla dolaylı olarak taklit edilebilir). agent-ctrl, `syncAgentsAsSkills` ile agent'ları `.pi/skills/`'e skill olarak yazar ve "Pi does not support custom agents. Agents are being written as skills instead." uyarısı üretir.

**Gerekçe**: Bu tam olarak Windsurf ve Cursor adaptörlerinin, "persona yok ama native skill var" durumunda izlediği kodlanmış emsaldir (`WindsurfAdapter.ts:91-97`, `CursorAdapter.ts:76-82`). Alternatif olan Gemini'nin "sessizce düşür + genel uyarı" (`countUnsupportedArtifacts`) emsali, Pi'nin native bir skill hedefi olduğu için daha az bilgilendirici olurdu; bu yüzden reddedildi.

## Karar 6 — MCP hedefi: uygulanmaz + uyarı

**Karar**: Pi'ye hiçbir MCP yapılandırma dosyası yazılmaz; `mcpServers.length > 0` olduğunda "Pi does not support MCP server configuration. MCP servers will not be applied." uyarısı üretilir. Yeni bir `IMcpConfigRenderer` implementasyonu YOKTUR.

**Gerekçe**: Pi'nin tüm resmi dokümantasyon sayfaları (`configuration.md`, `settings.md`, `providers.md`, `custom-provider.md`, `cli.md`) taranmış, hiçbir `mcp.json`/MCP ayarı bulunamamıştır — MCP entegrasyonu yalnızca elle yazılmış bir TypeScript extension (`pi.registerProvider()`/`pi.registerTool()`) ile mümkündür, bu agent-ctrl'in üretebileceği statik bir yapılandırma dosyası değildir. Emsal: Windsurf/Cursor adaptörlerinin aynı "MCP desteklenmiyor" kod örüntüsü (`WindsurfAdapter.ts:99-102`, `CursorAdapter.ts:98-101`).

## Karar 7 — Model frontmatter: tüm artifact türlerinde düşür

**Karar**: `ModelCapabilityMatrix.ts`'e `pi: { command: drop(), agent: drop(), skill: drop() }` satırı eklendi.

**Gerekçe**: Pi dokümantasyonu (`models.md`), model seçiminin CLI bayrağı (`pi --model <provider/id>`) veya `settings.json`'ın `defaultProvider`/`defaultModel` alanları üzerinden oturum/global kapsamlı olduğunu, `SKILL.md` veya prompt template dosyalarında YAML frontmatter tabanlı model pinning'i OLMADIĞINI gösteriyor. Bu, Cursor/Gemini/Windsurf/Antigravity için zaten var olan "tümü düşür" satırlarıyla aynı örüntüdür.

## Kaynaklar

- https://github.com/earendil-works/pi
- https://www.npmjs.com/package/@mariozechner/pi-coding-agent
- https://pi.dev (docs: `configuration.md`, `models.md`, `skills.md`, `prompt-templates.md`, `extensions.md`, `settings.md`, `cli.md`)
- https://agentskills.io/specification
- Repo içi emsaller: `src/infrastructure/features/forgecode/adapters/ForgeCodeAdapter.ts`, `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, `src/core/domain/shared/modelFrontmatter/ModelCapabilityMatrix.ts`
