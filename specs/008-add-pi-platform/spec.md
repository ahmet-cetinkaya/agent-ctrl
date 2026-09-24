# Feature Specification: Pi Platform Support

**Feature Branch**: `008-add-pi-platform`
**Created**: 2026-09-23
**Status**: Done
**Input**: User description: "Desteklenen platformlara -yeni bir branch'de- pi agent'ı da eklemek istiyorum." (Pi — `@earendil-works/pi-coding-agent`, https://pi.dev)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Kurallarımı Pi'ye tek komutla uygula (Priority: P1)

Bir kullanıcı, `rules/` altında tuttuğu davranış kurallarını `agent-ctrl apply pi` komutuyla Pi'nin okuyacağı bir `AGENTS.md` dosyasına aktarmak ister; böylece kuralları Pi için elle kopyalamak zorunda kalmaz.

**Why this priority**: Diğer tüm platform adaptörlerinin çekirdek değeri budur — kuralların tek kaynaktan, platforma özgü dosya biçimine dönüştürülmesi.

**Independent Test**: `agent-ctrl apply pi` (project scope) çalıştırılır; proje kökünde `AGENTS.md` dosyasının, yönetilen bir işaretçi (marker) bölümü içinde tüm kuralları içerdiği doğrulanır.

**Acceptance Scenarios**:

1. **Given** `rules/` altında en az bir kural dosyası, **When** `agent-ctrl apply pi` çalıştırılır, **Then** proje kökünde `AGENTS.md` oluşur/güncellenir ve kurallar yönetilen bölüm içinde yer alır.
2. **Given** `--scope user` ile çalıştırma, **When** `agent-ctrl apply pi --scope user` çalıştırılır, **Then** kurallar `~/.pi/agent/AGENTS.md` dosyasına yazılır.

---

### User Story 2 - Komutlarım Pi'de prompt template olarak çalışsın (Priority: P1)

Bir kullanıcı, `commands/` altında tanımladığı özel komutların Pi'de `/isim` slash komutu olarak kullanılabilmesini ister.

**Why this priority**: Komutlar, kural setinden sonra en sık kullanılan artifact türüdür; Pi'nin kendi "prompt template" biçimine (dosya adı → komut adı, `description` frontmatter) dönüştürülmeleri gerekir.

**Independent Test**: Bir komutla `agent-ctrl apply pi` çalıştırılır; `prompts/` altında, `description` frontmatter'ı içeren düz bir markdown dosyası üretildiği doğrulanır.

**Acceptance Scenarios**:

1. **Given** `commands/dev/fix-lint.md`, **When** `agent-ctrl apply pi` çalıştırılır, **Then** `.pi/prompts/fix-lint.md` üretilir ve frontmatter'ında `description` alanı bulunur.
2. **Given** alt dizinli bir komut kimliği (`dev/fix-lint`), **When** apply çalıştırılır, **Then** çıktı dosya adı yalnızca son segmentten türetilir (düzleştirilmiş), çünkü Pi'nin `prompts/` dizini alt dizin yapısını dokümante etmez.

---

### User Story 3 - Skill'lerim Pi'de native olarak çalışsın (Priority: P1)

Bir kullanıcı, `skills/` altındaki `SKILL.md` tabanlı yeteneklerinin Pi'de doğrudan (dönüştürülmeden) çalışmasını ister; çünkü Pi, Anthropic'in Agent Skills spesifikasyonuyla aynı formatı native destekler.

**Why this priority**: Skill'ler agent-ctrl'in en zengin artifact türüdür ve Pi bu yüzeyi native desteklediği için veri kaybı riski yoktur — yalnızca kopyalama gerekir.

**Independent Test**: Bir skill ile `agent-ctrl apply pi` çalıştırılır; `.pi/skills/<skill-id>/SKILL.md` dosyasının ve varsa ek varlık dosyalarının bire bir kopyalandığı doğrulanır.

**Acceptance Scenarios**:

1. **Given** `skills/git-workflow/SKILL.md`, **When** `agent-ctrl apply pi` çalıştırılır, **Then** `.pi/skills/git-workflow/SKILL.md` aynı içerikle (frontmatter normalize edilmiş) üretilir.

---

### User Story 4 - Pi'nin desteklemediği yüzeylerde sessiz veri kaybı olmasın (Priority: P2)

Bir kullanıcı, `agents/` personaları veya `mcps/` sunucu tanımları içeren bir projeye `agent-ctrl apply pi` çalıştırdığında, sistemin bu bilgiyi sessizce atmamasını, ne olduğunu açıkça bildirmesini ister — çünkü Pi'de ne bir persona/subagent dosya biçimi ne de native bir MCP yapılandırma yüzeyi vardır.

**Why this priority**: Sessiz veri kaybı, agent-ctrl'in tüm platform adaptörlerinde anayasal bir ilkedir (bkz. `.specify/memory/constitution.md` İlke II — "Çatışmalar MUST açık, eyleme geçirilebilir sonuç üretmeli").

**Independent Test**: Agent ve MCP sunucusu içeren bir projeye `agent-ctrl apply pi` çalıştırılır; agent'ların skill olarak yazıldığı ve MCP sunucularının hiçbir dosyaya yazılmadığı, her ikisi için de gerekçeli bir uyarının sonuç listesinde bulunduğu doğrulanır.

**Acceptance Scenarios**:

1. **Given** `agents/architect.md`, **When** `agent-ctrl apply pi` çalıştırılır, **Then** `.pi/skills/architect/SKILL.md` üretilir ve sonuç uyarılarında agent'ların skill olarak yazıldığını ve native destek için `pi-subagents` topluluk eklentisinin (`pi install npm:pi-subagents`) kurulabileceğini belirten bir mesaj bulunur.
2. **Given** `mcps/context7.json` ve `pi-mcp-adapter` eklentisi kurulu DEĞİL (bkz. User Story 6), **When** `agent-ctrl apply pi` çalıştırılır, **Then** hiçbir MCP yapılandırma dosyası yazılmaz ve sonuç uyarılarında MCP desteği için `pi-mcp-adapter` topluluk eklentisinin (`pi install npm:pi-mcp-adapter`) kurulabileceğini belirten bir mesaj bulunur.

---

### User Story 6 - `pi-mcp-adapter` kuruluysa MCP sunucuları fiilen uygulansın (Priority: P2)

Bir kullanıcı, projesinde veya kişisel Pi kurulumunda `pi-mcp-adapter` topluluk eklentisini zaten kurmuşsa, `agent-ctrl apply pi`'nin MCP sunucularını "desteklenmiyor" diye atlamak yerine, o eklentinin okuduğu dosyaya fiilen yazmasını ister.

**Why this priority**: En popüler Pi eklentisi (npm registry API ile doğrulanan ~1.01M indirme/ay) MCP'yi ekliyorsa, bunu göz ardı etmek kullanıcıya gereksiz elle iş yükler; ama eklenti kurulu değilken aynı şeyi yapmak (bkz. Karar 8'in reddettiği alternatif) potansiyel kimlik bilgisi içeren bir dosyayı istemsizce diske yazar — bu yüzden P1 değil, tespit mekanizması riski netleştirdiği için P2.

**Independent Test**: `.pi/settings.json` (veya kullanıcı kökündeki `settings.json`) içinde `packages: [{ source: "npm:pi-mcp-adapter" }]` bildirilmiş bir projede MCP sunucusu içeren bir yapılandırmayla `agent-ctrl apply pi` çalıştırılır; `.mcp.json`'da (proje) veya `<userRoot>/mcp.json`'da (kullanıcı) sunucunun doğru biçimde yazıldığı ve "MCP servers were not applied" uyarısının ARTIK görünmediği doğrulanır.

**Acceptance Scenarios**:

1. **Given** proje kökünde `.pi/settings.json` → `packages: [{ source: "npm:pi-mcp-adapter" }]` ve `mcps/context7.json`, **When** `agent-ctrl apply pi` çalıştırılır, **Then** `.mcp.json` oluşur/güncellenir, `{ "mcpServers": { "context7": {...} } }` biçimini içerir, sonuç mesajı "(via pi-mcp-adapter)" ifadesini içerir ve "MCP servers were not applied" uyarısı YOKTUR.
2. **Given** eklenti proje dosyasında değil, kullanıcının kişisel `settings.json`'ında (`~/.pi/agent/settings.json` veya `--path` ile verilen kök) bildirilmiş, proje kapsamında apply çalıştırılıyor, **When** `agent-ctrl apply pi` çalıştırılır, **Then** eklenti yine tespit edilir ve MCP `.mcp.json`'a uygulanır (kişisel kurulumlar Pi'nin kendi çalışma zamanında her projeye uygulanır).
3. **Given** `.pi/settings.json` bozuk JSON içeriyor veya `packages` alanında `pi-mcp-adapter` yerine başka bir paket bildiriyor, **When** `agent-ctrl apply pi` çalıştırılır, **Then** apply akışı kesintiye uğramaz ve sistem "kurulu değil" varsayarak User Story 4'teki fallback uyarı davranışına döner.

---

### User Story 5 - Model frontmatter Pi'de güvenle düşürülsün (Priority: P3)

Bir kullanıcı, `model`/`models` frontmatter alanı içeren bir command/agent/skill'i Pi'ye uyguladığında, Pi'nin per-artifact model seçimi olmadığından (model seçimi yalnızca CLI/`settings.json` kapsamlıdır) bu alanın sessizce yazılmamasını, gerekçeli bir uyarıyla düşürülmesini ister.

**Why this priority**: 007-cross-platform-model-frontmatter özelliğinin genel ilkesinin (bkz. `src/core/domain/shared/modelFrontmatter/ModelCapabilityMatrix.ts`) yeni platforma da tutarlı biçimde uygulanmasıdır; düşük öncelikli çünkü mevcut mekanizmaya tek bir tablo satırı eklemekten ibarettir.

**Independent Test**: `model: anthropic/claude-sonnet-4-5` içeren bir command ile `agent-ctrl apply pi` çalıştırılır; çıktı `prompts/` dosyasında `model` alanının bulunmadığı doğrulanır.

**Acceptance Scenarios**:

1. **Given** `model` içeren bir command/agent/skill, **When** `agent-ctrl apply pi` çalıştırılır, **Then** üretilen dosyada `model`/`models` alanı yoktur ve sonuç uyarılarında Pi'nin bu alanı desteklemediği bilgisi yer alır.

---

### User Story 7 - `pi-subagents` kuruluysa agent'lar native olarak uygulansın (Priority: P2)

Bir kullanıcı, projesinde veya kişisel Pi kurulumunda `pi-subagents` topluluk eklentisini zaten kurmuşsa, `agent-ctrl apply pi`'nin agent personalarını skill'e dönüştürmek yerine, o eklentinin okuduğu native `.pi/agents/*.md` dosyasına fiilen yazmasını ister — MCP için User Story 6'da yapılanla aynı desen.

**Why this priority**: `pi-subagents` de en popüler ikinci Pi eklentisi (npm registry API ile doğrulanan ~455K indirme/ay); "agent" (agent-ctrl'in davranış prompt'u) ile "subagent" (bu eklentinin ve Claude Code/Cursor/Antigravity'nin kullandığı terim) aynı kavram olduğu netleştirildikten sonra, MCP'dekiyle aynı gerekçeyle P2.

**Independent Test**: `.pi/settings.json`'da `packages: [{ source: "npm:pi-subagents" }]` bildirilmiş bir projede agent içeren bir yapılandırmayla `agent-ctrl apply pi` çalıştırılır; `.pi/agents/<id>.md`'de agent'ın `name`/`description` frontmatter'lı doğru biçimde yazıldığı ve "Agents are being written as skills instead" uyarısının ARTIK görünmediği doğrulanır.

**Acceptance Scenarios**:

1. **Given** proje kökünde `.pi/settings.json` → `packages: [{ source: "npm:pi-subagents" }]` ve `agents/architect.md`, **When** `agent-ctrl apply pi` çalıştırılır, **Then** `.pi/agents/architect.md` oluşur, `name: architect` içerir, sonuç mesajı "agents via pi-subagents" ifadesini içerir, "Agents are being written as skills instead" uyarısı YOKTUR ve `.pi/skills/architect/` OLUŞMAZ.
2. **Given** eklenti proje dosyasında değil, kullanıcının kişisel `settings.json`'ında bildirilmiş, proje kapsamında apply çalıştırılıyor, **When** `agent-ctrl apply pi` çalıştırılır, **Then** eklenti yine tespit edilir ve agent `.pi/agents/`'a uygulanır.
3. **Given** `.pi/settings.json` bozuk JSON içeriyor veya `pi-subagents` yerine başka bir paket bildiriyor, **When** `agent-ctrl apply pi` çalıştırılır, **Then** apply akışı kesintiye uğramaz ve sistem User Story 4'teki skill-dönüştürme fallback'ine döner.
4. **Given** `pi-subagents` tespit edilmiş ve kaynak agent dosyasında zaten bir `model:`/`tools:` frontmatter alanı varsa, **When** `agent-ctrl apply pi` çalıştırılır, **Then** bu alanlar `.pi/agents/<id>.md` çıktısında AYNEN korunur (agent-ctrl kendisi bir `model` alanı yazmaz/dönüştürmez).

---

### Edge Cases

- Proje köşesinde `AGENTS.md` zaten mevcutsa ve elle eklenmiş içerik taşıyorsa: yalnızca yönetilen işaretçi (marker) bölümü güncellenir, dosyanın kalanı korunur (mevcut `upsertManagedRuleDocument` davranışı).
- `--override` bayrağıyla çalıştırıldığında: `.pi/prompts/`, `.pi/skills/` VE `.pi/agents/` dizinleri temizlenip yeniden yazılır; `AGENTS.md` dosyası marker mekanizmasıyla güncellendiği için ayrıca silinmez.
- Hiç kural/komut/skill/agent/MCP sunucusu yoksa: `AGENTS.md`'de "No managed Pi rules were found." mesajı yazılır, diğer dizinler oluşturulmaz, hiçbir uyarı üretilmez.
- `--scope user` ve özel `--user-config-root` birlikte verildiğinde: varsayılan `~/.pi/agent` yerine verilen kök kullanılır.
- `pi-mcp-adapter` tespiti için okunan `settings.json` bozuk JSON içeriyorsa veya dosya mevcut değilse: apply akışı kesintiye uğramaz, sistem "kurulu değil" varsayar ve mevcut fallback uyarısına döner.
- `pi-mcp-adapter` HEM proje HEM kullanıcı `settings.json`'ında farklı biçimlerde bildirilmişse (örn. biri sürüm eki içeriyor): herhangi birinde geçerli bir eşleşme bulunması yeterlidir (OR mantığı).
- `pi-mcp-adapter` VE `pi-subagents` AYNI ANDA tespit edilirse: her iki tespit birbirinden bağımsızdır, ikisi de kendi native yüzeyine (`.mcp.json` ve `.pi/agents/`) yazılır; `message` alanında ikisi de "and" ile birleştirilerek raporlanır.
- Kaynak agent dosyasında zaten `model:` frontmatter alanı varsa VE `pi-subagents` tespit edilmişse: `.pi/agents/<id>.md` çıktısında bu alan aynen korunur (agent-ctrl bunu ne yazar ne dönüştürür — bkz. FR-005a).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Sistem, `"pi"` değerini `agent-ctrl apply <platform>`, `agent-ctrl build <platform>` ve `agent-ctrl profile apply <platform>` komutlarında geçerli bir hedef platform olarak kabul etmelidir.
- **FR-002**: Sistem, kuralları proje kapsamında proje kökündeki `AGENTS.md`'ye, kullanıcı kapsamında `~/.pi/agent/AGENTS.md`'ye (veya verilen `--user-config-root`'a) yönetilen bir bölüm olarak yazmalıdır.
- **FR-003**: Sistem, komutları proje kapsamında `.pi/prompts/`'a, kullanıcı kapsamında `<userRoot>/prompts/`'a, dosya adı komut kimliğinin son segmentinden türetilmiş `description` frontmatter'lı düz markdown olarak yazmalıdır.
- **FR-004**: Sistem, skill'leri proje kapsamında `.pi/skills/`'a, kullanıcı kapsamında `<userRoot>/skills/`'a `SKILL.md` + ek varlık dosyalarıyla birebir kopyalamalıdır.
- **FR-005**: Sistem, `pi-subagents` topluluk eklentisi tespit edilmediği sürece agent personalarını Pi'nin persona/subagent dosya biçimi olmadığından skill dizinine (`.pi/skills/` veya `<userRoot>/skills/`) dönüştürülmüş olarak yazmalı ve gerekçeli bir uyarı üretmelidir.
- **FR-005a**: Sistem, `pi-subagents`'ın kurulu olup olmadığını FR-006a'daki AYNI manifest tespit mekanizmasıyla (`packages: [{ source: "npm:pi-subagents"[@sürüm] }]`) tespit etmelidir. Tespit edilirse agent'lar `.pi/agents/<id>.md` (proje) / `<userRoot>/agents/<id>.md` (kullanıcı) dosyasına `name`/`description` frontmatter'lı (mevcut `tools`/`model` gibi diğer alanlar korunarak) yazılmalı ve FR-005'teki uyarı üretilmemelidir. Sistem bu yüzeyde bir `model` alanı KENDİSİ yazmamalı/dönüştürmemelidir (bkz. research.md Karar 10).
- **FR-006**: Sistem, `pi-mcp-adapter` topluluk eklentisi tespit edilmediği sürece MCP sunucu tanımlarını Pi'ye hiçbir dosyaya yazmamalı ve gerekçeli bir uyarı üretmelidir (Pi'nin native MCP yapılandırma yüzeyi yoktur).
- **FR-006a**: Sistem, `pi-mcp-adapter`'ın kurulu olup olmadığını Pi'nin `packages: [{ source: "npm:pi-mcp-adapter"[@sürüm] }]` manifest alanını (proje: `.pi/settings.json`; kullanıcı: `<userRoot>/settings.json`; proje kapsamında her ikisi de kontrol edilir) okuyarak tespit etmelidir. Tespit edilirse MCP sunucuları `.mcp.json` (proje) / `<userRoot>/mcp.json` (kullanıcı) dosyasına standart `mcpServers` biçiminde yazılmalı ve FR-006'daki uyarı üretilmemelidir.
- **FR-007**: Sistem, `model`/`models` frontmatter alanını Pi'nin tüm artifact türlerinde (`command`, `agent`, `skill`) düşürmeli ve gerekçeli bir uyarı üretmelidir (mevcut cross-platform model frontmatter mekanizmasına bir capability matrix satırı eklenerek).
- **FR-008**: `--override` bayrağı verildiğinde sistem, önceden yazılmış `.pi/prompts/` ve `.pi/skills/` (veya kullanıcı kapsamı eşdeğerleri) içeriğini temizleyip yeniden yazmalıdır.
- **FR-009**: `agent-ctrl apply pi` çağrısı `request` içinde `targetScope`/`userConfigRootPath` verilmeden yapıldığında, varsayılan kapsam `"user"` ve varsayılan kullanıcı kökü `~/.pi/agent` olmalıdır (diğer platform adaptörleriyle tutarlı varsayılan davranış).
- **FR-010**: Kullanıcı dokümantasyonu (README, `docs/platforms/PI.md`) Pi'nin desteklenen platform listesine eklenmesini, model frontmatter destek matrisindeki yerini, platforma özgü davranışları (agent→skill, MCP eklenti-tespitli) ve `pi-mcp-adapter`/`pi-subagents` topluluk eklentilerini açıklamalıdır.

### Key Entities _(include if feature involves data)_

- **PiAdapter**: `IApplyPlatformAdapter` sözleşmesini uygulayan, Pi'ye özgü hedef çözümleme ve senkronizasyon mantığını taşıyan bileşen. Var olan diğer 10 platform adaptörüyle aynı sözleşmeyi paylaşır; yeni bir entity türü eklemez.
- **PiCommandRenderer**: `ICommandRenderer` sözleşmesini uygulayan, komut markdown'ını Pi'nin `description`-only frontmatter biçimine dönüştüren bileşen.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `agent-ctrl apply pi` (project ve user scope), tüm mevcut artifact türlerini (rules, commands, skills, agents, mcps) hatasız işler ve `bun test` ile doğrulanan beklenen dosya/uyarı çıktısını üretir.
- **SC-002**: Pi, `SUPPORTED_APPLY_PLATFORMS` listesine eklendiği için `PlatformAdapterRegistry` başlangıç doğrulaması (`ADAPTER_NOT_REGISTERED` hatası) ve `PlatformCustomizationSurfaceContract` sözleşme testi, kod değişikliği gerektirmeden Pi'yi de kapsar.
- **SC-003**: Model desteklenmeyen her Pi yüzeyinde, kullanıcıya gösterilen uyarı olmadan `model`/`models` bilgisi içeren tek bir çıktı dosyası üretilmez (sessiz kayıp sıfır; 007 özelliğiyle aynı garanti).
- **SC-004**: Mevcut 10 platformun apply çıktıları, bu özellik nedeniyle içerik olarak değişmez (yalnızca ekleme; %100 geriye uyumluluk).
- **SC-005**: Tüm davranış birim (`PiAdapter.test.ts`) ve sözleşme (`PlatformCustomizationSurfaceContract.test.ts`) testleriyle kapsanır; `bun test`, `bunx tsc --noEmit` ve `scripts/lint.sh` hatasız geçer.
- **SC-006**: `pi-mcp-adapter` tespit edildiğinde MCP sunucuları doğru dosyaya (proje: `.mcp.json`; kullanıcı: `<userRoot>/mcp.json`) doğru `mcpServers` biçiminde yazılır; tespit edilmediğinde (dosya yok, bozuk JSON, farklı paket) davranış FR-006'daki fallback ile birebir aynıdır (regresyon yok).
- **SC-007**: `pi-subagents` tespit edildiğinde agent'lar doğru dosyaya (proje: `.pi/agents/<id>.md`; kullanıcı: `<userRoot>/agents/<id>.md`) `name`/`description` frontmatter'lı olarak yazılır, mevcut `tools`/`model` alanları korunur; tespit edilmediğinde davranış FR-005'teki skill-dönüştürme fallback'i ile birebir aynıdır (regresyon yok).
