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

**Karar**: Pi'de birinci sınıf bir persona/subagent dosya biçimi YOK (yalnızca extension/skill/prompt-template mekanizmalarıyla dolaylı olarak taklit edilebilir). agent-ctrl, `syncAgentsAsSkills` ile agent'ları `.pi/skills/`'e skill olarak yazar ve gerekçeli bir uyarı üretir.

**Gerekçe**: Bu tam olarak Windsurf ve Cursor adaptörlerinin, "persona yok ama native skill var" durumunda izlediği kodlanmış emsaldir (`WindsurfAdapter.ts:91-97`, `CursorAdapter.ts:76-82`). Alternatif olan Gemini'nin "sessizce düşür + genel uyarı" (`countUnsupportedArtifacts`) emsali, Pi'nin native bir skill hedefi olduğu için daha az bilgilendirici olurdu; bu yüzden reddedildi.

## Karar 6 — MCP hedefi: uygulanmaz + uyarı

> **GÜNCELLEME (Karar 9'a bakınız)**: Bu kararın "hiçbir dosyaya yazılmaz" kısmı, `pi-mcp-adapter` eklentisi tespit edildiğinde YAZAR şeklinde revize edildi. Aşağıdaki orijinal karar/gerekçe, eklenti YOKKEN geçerli fallback davranışını doğru şekilde tanımlamaya devam ediyor.

**Karar**: Pi'ye hiçbir MCP yapılandırma dosyası yazılmaz; `mcpServers.length > 0` olduğunda gerekçeli bir uyarı üretilir. Yeni bir `IMcpConfigRenderer` implementasyonu YOKTUR.

**Gerekçe**: Pi'nin tüm resmi dokümantasyon sayfaları (`configuration.md`, `settings.md`, `providers.md`, `custom-provider.md`, `cli.md`) taranmış, hiçbir `mcp.json`/MCP ayarı bulunamamıştır — MCP entegrasyonu yalnızca elle yazılmış bir TypeScript extension (`pi.registerProvider()`/`pi.registerTool()`) ile mümkündür, bu agent-ctrl'in üretebileceği statik bir yapılandırma dosyası değildir. Emsal: Windsurf/Cursor adaptörlerinin aynı "MCP desteklenmiyor" kod örüntüsü (`WindsurfAdapter.ts:99-102`, `CursorAdapter.ts:98-101`).

## Karar 7 — Model frontmatter: tüm artifact türlerinde düşür

**Karar**: `ModelCapabilityMatrix.ts`'e `pi: { command: drop(), agent: drop(), skill: drop() }` satırı eklendi.

**Gerekçe**: Pi dokümantasyonu (`models.md`), model seçiminin CLI bayrağı (`pi --model <provider/id>`) veya `settings.json`'ın `defaultProvider`/`defaultModel` alanları üzerinden oturum/global kapsamlı olduğunu, `SKILL.md` veya prompt template dosyalarında YAML frontmatter tabanlı model pinning'i OLMADIĞINI gösteriyor. Bu, Cursor/Gemini/Windsurf/Antigravity için zaten var olan "tümü düşür" satırlarıyla aynı örüntüdür.

## Karar 8 — Desteklenmeyen yüzeyler için uyarı metninde en popüler topluluk eklentisini adlandır

**Karar**: Agent→skill ve MCP→uygulanmaz uyarı metinleri, her yüzey için doğrulanmış en popüler topluluk eklentisini ve kurulum komutunu adlandıracak şekilde güncellendi:

- Agents: `"Pi has no native agent/persona format. Agents are being written as skills instead. For native .pi/agents/ support, install the community 'pi-subagents' extension: pi install npm:pi-subagents"`
- MCP: `"Pi has no native MCP configuration surface. MCP servers were not applied. For MCP support, install the community 'pi-mcp-adapter' extension: pi install npm:pi-mcp-adapter"`

**Gerekçe**: Pi'nin çekirdeği kasıtlı olarak minimaldir — hem MCP hem de subagent desteği, npm registry API ile doğrulanan (2026-09-23) indirme sayılarına göre net favori olan iki topluluk eklentisiyle (`pi-mcp-adapter`: ~1.01M indirme/ay, `pi-subagents`: ~455K indirme/ay — ikisi de aynı yazar, Nico Bailon) kapatılabiliyor. Kullanıcıya "desteklenmiyor" demek yerine "şu eklentiyle destekleniyor, kurulum komutu bu" demek, aynı anayasal V ilkesinin ("actionable diagnostics") doğal bir uzantısı.

**Bu adımda reddedilen, Karar 9'da MCP için kabul edilen alternatif**: `.mcp.json`/`.pi/agents/*.md` dosyalarını doğrudan yazmak (her iki eklenti de bu konumları/biçimi okuyor, yani kuruluysa "otomatik çalışırdı"). Bu adımda reddedildi çünkü: (1) MCP sunucu tanımları potansiyel kimlik bilgisi taşıyabilir — eklenti kurulu olmayan kullanıcıda bile bu dosyayı diske yazmak, Karar 6'daki bilinçli "hiçbir dosyaya yazma" güvenlik gerekçesini tersine çevirir; (2) bu, üçüncü taraf bir paketin varlığını zımnen zorunlu kılan/varsayan daha büyük bir davranış değişikliğidir ve kullanıcı onayı gerektirir — sadece uyarı metnini iyileştirmekten farklı bir karardır. **Kullanıcı bu davranış değişikliğini MCP için açıkça talep etti (2026-09-23) — bkz. Karar 9.** Agents/`pi-subagents` tarafı için de kullanıcı aynı deseni ayrıca, ayrı bir onayla talep etti (2026-09-24) — bkz. Karar 10.

## Karar 9 — MCP için eklenti tespiti: kuruluysa `.mcp.json`'a yaz, değilse Karar 6/8'deki fallback'e düş

**Karar**: `PiAdapter`, `applyApplyIntegration` sırasında Pi'nin kendi paket manifestini (`packages: [{ source: "npm:<ad>[@sürüm]" }]` — proje: `.pi/settings.json`, kişisel: `<userRoot>/settings.json`) okuyarak `pi-mcp-adapter`'ın kurulu olup olmadığını denetler:

- **Tespit edilirse**: MCP sunucuları `pi-mcp-adapter`'ın okuduğu tam konuma — proje kapsamında `.mcp.json`, kullanıcı kapsamında `<userRoot>/mcp.json` — standart `{ "mcpServers": {...} } ` biçiminde (yeni `PiMcpConfigRenderer`, ForgeCode'un aynı biçimiyle) yazılır. Uyarı ÜRETİLMEZ; `message` alanına "(via pi-mcp-adapter)" eklenir.
- **Tespit edilmezse**: Karar 6/8'deki mevcut davranış (hiçbir dosyaya yazma + eklentiyi adlandıran uyarı) değişmeden devam eder.
- Proje kapsamında denetim HEM proje HEM kullanıcı `settings.json`'ını kontrol eder (Pi'nin kendi çalışma zamanı davranışı: kişisel paketler her projeye uygulanır); kullanıcı kapsamında yalnızca kullanıcı dosyası kontrol edilir.

**Gerekçe**: Kullanıcı bunu açıkça talep etti: "ilgili pluginin olup olmadığını kontrol edip, eğer varsa plugine göre ilgili yerlere mcp apply yapabilir miyiz?" (2026-09-23). Karar 8'de reddedilen "doğrudan yaz" alternatifinin güvenlik itirazı (_eklenti kurulu olmayan kullanıcıya bile potansiyel kimlik bilgisi içeren dosya yazmak_) burada dosya tabanlı, best-effort bir tespit kapısıyla çözülüyor: yalnızca eklentinin zaten kurulu OLDUĞU (yani kullanıcının MCP'yi bilerek etkinleştirdiği) durumlarda yazılıyor.

**Bu adımda kapsam dışı bırakılan (bilinçli), Karar 10'da kabul edilen**: `pi-subagents` için aynı tespit + `.pi/agents/*.md`'ye doğrudan yazma. Kullanıcı bu adımda yalnızca "mcp apply" istedi; agents tarafı hâlâ skill'e dönüştürme + uyarı ile kaldı. **Kullanıcı bunu bir gün sonra (2026-09-24) ayrıca talep etti — bkz. Karar 10.**

**Tespitin sınırı**: Dosya tabanlı ve best-effort — Pi'nin ".pi/ yalnızca proje trust'ı verildikten sonra yüklenir" çalışma zamanı kısıtlamasını gözlemleyemez; `.pi/settings.json`'da paket bildirilmiş ama trust henüz verilmemiş olsa bile "kurulu" sayılır. Bozuk JSON veya eksik dosya → "kurulu değil" (apply akışını asla kesintiye uğratmaz).

## Karar 10 — Agents için de aynı eklenti-tespiti deseni: kuruluysa `.pi/agents/*.md`'ye native yaz

**Karar**: `PiAdapter`, agent artifact'leri işlerken de Karar 9'daki AYNI `isPackageInstalled()` yardımcı fonksiyonunu `"pi-subagents"` paket adıyla çağırır:

- **Tespit edilirse**: agent'lar `syncAgentsAsMarkdown` ile yeni `PiAgentRenderer` (name + description frontmatter; ForgeCode'un `id`+`title` yerine `name` kullanır, çünkü `pi-subagents`'ın şeması `name`'i zorunlu kılıyor) kullanılarak `.pi/agents/<id>.md` (proje) / `<userRoot>/agents/<id>.md` (kullanıcı)'ya yazılır. Uyarı ÜRETİLMEZ; `message`'a "agents via pi-subagents" eklenir. `--override` ile `.pi/agents/` de temizlenir (yeni `agentsRoot` — `promptsRoot`/`skillsRoot` ile birlikte).
- **Tespit edilmezse**: Karar 5/8'deki mevcut davranış (skill'e dönüştür + eklentiyi adlandıran uyarı) değişmeden devam eder.

**Gerekçe**: Kullanıcı bunu MCP'den bir gün sonra, "agent (behavior prompt) ile subagent aynı şey mi?" sorusuna verdiğim yanıtı (agent-ctrl'in `agents/` artifact'i ile Claude Code/Cursor/Antigravity'nin "subagent" dediği şeyin aynı kavram olduğu, ve `pi-subagents`'ın kendi şemasının — `name`/`description`/`model`/`tools` — bunu doğrudan doğruladığı) onayladıktan sonra açıkça istedi. Karar 9'daki güvenlik itirazı burada geçerli değil (agent tanımları, MCP sunucu tanımlarının aksine, tipik olarak kimlik bilgisi taşımaz) — asıl gerekçe yalnızca "kullanıcı onayı gerektiren davranış değişikliği" kısıtıydı, o da artık verildi.

**Model frontmatter'a dokunulmadı**: `pi-subagents`'ın şeması bir `model` alanı destekliyor olsa da, `ModelCapabilityMatrix["pi"].agent` hâlâ `drop()`. Değer biçimi (agent-ctrl'in kanonik `provider/model-id`'si ile `pi-subagents`'ın beklediği biçim aynı mı?) resmi dokümantasyonda kesin olarak doğrulanmadı — 007 özelliğinin "tahmin etme, yalnızca doğrulanmış format kuralı" ilkesine göre, kesinleşmeden `passthrough()`'a geçmek riskli olurdu. Var olan bir `model:` alanı (kullanıcı elle eklemişse) frontmatter'da korunur (silinmez), ama agent-ctrl kendisi bir `model:` yazmaz/dönüştürmez.

**Tespitin sınırı**: Karar 9 ile birebir aynı (dosya tabanlı, best-effort, bozuk/eksik `settings.json` → "kurulu değil").

## Kaynaklar

- https://github.com/earendil-works/pi
- https://www.npmjs.com/package/@mariozechner/pi-coding-agent
- https://pi.dev (docs: `configuration.md`, `models.md`, `skills.md`, `prompt-templates.md`, `extensions.md`, `settings.md`, `cli.md`)
- https://agentskills.io/specification
- https://github.com/nicobailon/pi-mcp-adapter · https://www.npmjs.com/package/pi-mcp-adapter (indirme istatistiği: `api.npmjs.org/downloads/point/last-month/pi-mcp-adapter`)
- https://github.com/nicobailon/pi-subagents · https://www.npmjs.com/package/pi-subagents (indirme istatistiği: `api.npmjs.org/downloads/point/last-month/pi-subagents`)
- Repo içi emsaller: `src/infrastructure/features/forgecode/adapters/ForgeCodeAdapter.ts`, `src/infrastructure/features/windsurf/adapters/WindsurfAdapter.ts`, `src/infrastructure/features/cursor/adapters/CursorAdapter.ts`, `src/core/domain/shared/modelFrontmatter/ModelCapabilityMatrix.ts`
