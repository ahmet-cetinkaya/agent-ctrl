# Feature Specification: Cross-Platform Model Frontmatter

**Feature Branch**: `007-cross-platform-model-frontmatter`
**Created**: 2026-09-21
**Status**: Draft
**Input**: User description: "Bir command çalıştırıldığında ilgili command'in frontmatter'ında hangi modelle çalışacağını girebiliyor muyuz? Diğer desteklediğimiz platformlar destekliyor mu? Tüm platformlara uyumlu olacak şekilde handle edebilir miyiz? Bu ve bunun gibi platform'a özel frontmatter property'ler için."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Tek yerde model belirle, her yerde çalışsın (Priority: P1)

Bir kullanıcı, agent-ctrl'de tuttuğu bir command'in veya agent'ın hangi AI modeliyle çalışacağını tek bir yerde, artifact'in frontmatter'ında belirtmek ister (`model: anthropic/claude-sonnet-4-5` gibi). `agent-ctrl apply <platform>` çalıştırdığında, bu bilgi hedef platformun anladığı biçime otomatik çevrilir: Claude'da `provider/` öneki kırpılır, OpenCode/Kilo'da aynen geçirilir, ForgeCode agent'larında ayrı `model` + `provider` alanlarına bölünür, Codex agent'larında TOML `model` alanına yazılır.

**Why this priority**: Özelliğin çekirdek değeri budur — model tercihini bir kez yazıp platform başına elle kopyalama/düzeltme ihtiyacını ortadan kaldırır.

**Independent Test**: `model` frontmatter alanı içeren bir command/agent ile `apply` çalıştırılır; hedef platformdaki çıktı dosyasında model bilgisinin doğru biçimde bulunduğu doğrulanır.

**Acceptance Scenarios**:

1. **Given** `model: anthropic/claude-sonnet-4-5` içeren bir command, **When** `apply claude` çalıştırılır, **Then** Claude komut dosyasında `model: claude-sonnet-4-5` yazar (önek kırpılmış).
2. **Given** aynı command, **When** `apply opencode` çalıştırılır, **Then** OpenCode komut dosyasında `model: anthropic/claude-sonnet-4-5` aynen yazar.
3. **Given** `model: anthropic/claude-sonnet-4-5` içeren bir agent, **When** `apply forgecode` çalıştırılır, **Then** ForgeCode agent dosyasında `model: claude-sonnet-4-5` ve `provider: anthropic` olarak iki ayrı alan yazar.
4. **Given** aynı agent, **When** `apply codex` çalıştırılır, **Then** Codex agent TOML dosyasında `model = "anthropic/claude-sonnet-4-5"` satırı bulunur.

---

### User Story 2 - Platform modeli desteklemiyorsa uyar (Priority: P1)

Bir kullanıcı, model desteği olmayan bir yüzeye (ör. Gemini komutları, Windsurf, Cursor, ForgeCode komutları) model bilgisi içeren bir artifact uyguladığında, sistem sessizce bu bilgiyi kaybetmez: alan çıktıdan düşürülür ve kullanıcıya neden düşürüldüğünü açıklayan bir uyarı gösterilir.

**Why this priority**: Sessiz veri kaybı güveni yok eder; açık uyarı kullanıcıya neyi nerede düzeltmesi gerektiğini söyler ve anayasanın "çatışmalar açık sonuç üretmeli" ilkesini korur.

**Independent Test**: `model` içeren bir command ile desteklemeyen platforma `apply` çalıştırılır; çıktıda `model` alanının bulunmadığı ve uyarı listesinde açıklamanın yer aldığı doğrulanır.

**Acceptance Scenarios**:

1. **Given** `model` içeren bir command, **When** `apply gemini` çalıştırılır, **Then** üretilen TOML'da model bilgisi yoktur ve sonuç uyarılarında Gemini komutlarının model alanını desteklemediği bilgisi yer alır.
2. **Given** `model` içeren bir command, **When** `apply windsurf` çalıştırılır, **Then** workflow çıktısında model bilgisi yoktur ve aynı biçimde uyarı gösterilir.

---

### User Story 3 - Kısıtlı platformlar için açık override (Priority: P2)

Bazı platformlar serbest model kimliği yerine kısıtlı bir değer kümesi kabul eder (ör. Qwen agent'ları `inherit`/`fast`/model-id). Sistem kullanıcı adına tahmin yapmaz; kullanıcı `models:` haritasıyla platforma özel değeri açıkça yazar:

```yaml
model: anthropic/claude-sonnet-4-5
models:
  qwen: fast
```

`models.<platform>` değeri, genel `model` değerinden önceliklidir ve platforma aynen yazılır.

**Why this priority**: Tahminsel eşleme yanlış modele sessizce düşme riski taşır; açık override doğruluğu garanti eder ve özelliği her platforma genişletir.

**Independent Test**: `models:` haritası içeren bir agent hedef platforma uygulanır; override değerinin platform çıktısına aynen geçtiği doğrulanır.

**Acceptance Scenarios**:

1. **Given** `model: anthropic/claude-sonnet-4-5` ve `models: { qwen: fast }` içeren bir agent, **When** `apply qwen` çalıştırılır, **Then** Qwen agent çıktısında `model: fast` yazar.
2. **Given** aynı agent, **When** `apply opencode` çalıştırılır, **Then** OpenCode çıktısında genel değer `anthropic/claude-sonnet-4-5` yazar (override yalnızca qwen için geçerli).
3. **Given** `models:` haritası, **When** herhangi bir platforma apply çalıştırılır, **Then** `models` haritası hedef platform dosyalarına ASLA yazılmaz (agent-ctrl'e özgü yapılandırma alanıdır).

---

### User Story 4 - Geçersiz override kullanımında bilgilendir (Priority: P3)

Bir kullanıcı `models:` haritasında desteklenmeyen bir platform adı kullanırsa veya model desteği olmayan bir yüzeye override yazarsa, sistem uygulanabilir bir uyarı üretir ve geçerli işlemin geri kalanını bozmaz.

**Why this priority**: Hatalı yapılandırmanın sessiz kalması hata ayıklamayı zorlaştırır; uyarı kullanıcıyı doğru sözdizimine yönlendirir.

**Independent Test**: Geçersiz platform anahtarı içeren bir `models:` haritasıyla apply çalıştırılır; uyarı listesinde sorun bildirilir ve diğer artifact'lerin uygulanmaya devam ettiği doğrulanır.

**Acceptance Scenarios**:

1. **Given** `models: { zzz: pro }` içeren bir artifact, **When** herhangi bir platforma apply çalıştırılır, **Then** "zzz" desteklenen bir platform adı değildir uyarısı gösterilir ve uygulama devam eder.
2. **Given** model desteklemeyen bir hedef için `models: { windsurf: sonnet }` override'ı, **When** `apply windsurf` çalıştırılır, **Then** override'ın yoksayıldığı ve nedeninin açıklandığı bir uyarı gösterilir; çıktıya model yazılmaz.

---

### Edge Cases

- `model` alanı yoksa ve `models:` yoksa: hiçbir değişiklik ve uyarı olmamalıdır (mevcut davranışla %100 geriye uyumluluk).
- `model` değeri `inherit`, `sonnet` gibi bir önek içermeyen kısa değerlerse: önek kırpma adımı değeri değiştirmemeli, aynen korunmalıdır.
- Frontmatter YAML olarak bozuksa: içerik olduğu gibi bırakılmalı, uyarı üretilmeli, apply işlemi düşmemelidir.
- Frontmatter hiç yoksa: içerik dokunulmadan geçirilmelidir.
- Aynı artifact hem `model` hem hedef platform için `models.<platform>` içerdiğinde: `models.<platform>` kazanır.
- Frontmatter'daki diğer bilinmeyen alanlar: mevcut davranış gibi aynen korunmalıdır (yalnızca `model`, `models` ve split durumunda `provider` yönetilir).
- `models:` haritasındaki değerler sayı, dizi gibi dize olmayan türlerse: uyarı üretilmeli ve değer yok sayılmalıdır.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Sistem, command ve agent artifact'larının frontmatter'ındaki `model` alanını tanımalı ve değerini platforma göre çözmelidir. Kanonik değer biçimi `provider/model-id` olmalıdır.
- **FR-002**: Sistem, `models:` haritasındaki platforma özel override'ları tanımalı ve öncelik sırası `models.<platform>` > `model` > (alan yok) olacak şekilde uygulamalıdır.
- **FR-003**: Sistem, platformun desteklediği biçime göre değeri dönüştürmelidir: Claude için önek kırpma (`anthropic/claude-x` → `claude-x`); OpenCode, Kilo, Codex (TOML `model` alanı) için aynen geçirme; ForgeCode agent'ları için `model` + `provider` olarak bölme.
- **FR-004**: Sistem, hedef yüzeyde model desteklenmiyorsa (Gemini komutları, Windsurf, Cursor, ForgeCode komutları, Claude dışındaki platformların skill'leri) `model`/override değerini çıktıdan düşürmeli ve gerekçeli bir uyarı üretmelidir.
- **FR-005**: Sistem, kısıtlı değer kümesi kabul eden platformlarda (ör. Qwen agent'ları) genel `model` değerini düşürüp "override gerekli" uyarısı vermeli; yalnızca açık `models.<platform>` override'ı platforma yazılmalıdır.
- **FR-006**: Sistem, `models:` haritasını hedef platform yapılandırmalarına hiçbir koşulda yazmamalıdır.
- **FR-007**: Sistem, `models:` haritasındaki desteklenmeyen platform anahtarlarını ve dize olmayan değerlerini uyarıyla bildirmeli ve işlemeye devam etmelidir.
- **FR-008**: Sistem, bozuk YAML frontmatter'a sahip artifact'ları değiştirmeden geçirmeli, uyarı üretmeli ve apply işlemini kesintiye uğratmamalıdır.
- **FR-009**: Sistem, mevcut frontmatter'daki `model` ve `models` dışındaki tüm alanları korumalıdır.
- **FR-010**: Sistem, uyarıları mevcut apply/profile apply uyarı akışı üzerinden kullanıcıya göstermelidir.
- **FR-011**: Kullanıcı dokümantasyonu (README), `model` ve `models` alanlarının kullanımını, destek matrisini ve override sözdizimini açıklamak üzere güncellenmelidir.

### Key Entities _(include if feature involves data)_

- **ModelCapability**: Bir platformun, bir artifact türü (command/agent/skill) için model alanını nasıl işlediği — dönüşüm kuralı (geçir/önek-kırp/böl) ve desteklenip desteklenmediği. Platform × artifact türü matrisi olarak tanımlıdır; model kimliklerinin listesini İÇERMEZ (yeni model çıkışı kod değişikliği gerektirmez).
- **ModelResolution**: Tek bir artifact-platform çifti için çözümleme sonucu — eylem (yaz/düşür/yok), dönüştürülmüş değer, (bölme durumunda) sağlayıcı ve üretilen uyarılar.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `model` veya `models` içeren artifact'ların apply'ı, destekleyen tüm platformlarda (Claude, OpenCode, Kilo, ForgeCode agent, Codex agent, Qwen agent override'lı) doğru biçimde yazılmış model değeriyle tamamlanır (test takımlarıyla doğrulanır; apply işlemi mevcut performans hedeflerini aşmaz).
- **SC-002**: Model desteklenmeyen her hedefte, kullanıcıya gösterilen uyarı olmadan model bilgisi içeren tek bir çıktı dosyası üretilmez (sessiz kayıp sıfır).
- **SC-003**: `model`/`models` alanı içermeyen mevcut projelerde apply çıktıları içerik olarak değişmez (%100 geriye uyumluluk).
- **SC-004**: Yeni bir model kimliği yayınlandığında, kullanıcı yeni kimliği `model` alanına yazabilmeli ve herhangi bir araç güncellemesi olmadan destekleyen platformlarda çalışmalıdır (kodda model listesi bulunmadığından doğrulanabilir).
- **SC-005**: Tüm davranış değişiklikleri birim, bütünleştirme ve sözleşme testleriyle kapsanır; `bun test` ve tip denetimi hatasız geçer.
