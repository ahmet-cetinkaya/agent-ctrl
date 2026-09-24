# Data Model: Pi Platform Support

Bu özellik yeni bir çekirdek veri türü tanımlamaz; mevcut platform-adaptörü sözleşmesinin Pi için bir örneğini ekler ve mevcut `ModelCapabilityMatrix` tablosuna bir satır ekler (bkz. `specs/007-cross-platform-model-frontmatter/data-model.md` — `ModelCapability` orada tanımlıdır).

## `SupportedApplyPlatform` (genişletme)

`src/core/domain/shared/types/SupportedApplyPlatform.ts` içindeki kapalı union'a `"pi"` eklenir; `PLATFORM_DISPLAY_NAMES["pi"] = "Pi"`.

**İnvariant**: `PlatformAdapterRegistry`'nin constructor doğrulaması (`ADAPTER_NOT_REGISTERED`), bu union'a eklenen her platformun bir factory'e sahip olmasını zorunlu kılar — bu yüzden `SupportedApplyPlatform` genişletmesi ve `PiAdapter` factory kaydı ATOMİK olarak birlikte yapılmalıdır.

## `ApplyConfigTarget` (Pi örneği)

| Alan         | Proje kapsamı değeri            | Kullanıcı kapsamı değeri (varsayılan)                      |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| `configPath` | `<projectPath>/AGENTS.md`       | `~/.pi/agent/AGENTS.md`                                    |
| `scope`      | `"project"`                     | `"user"` (varsayılan kapsam — diğer platformlarla tutarlı) |
| `surface`    | `"pi-agents-md-prompts-skills"` | `"pi-agents-md-prompts-skills"`                            |

## `ApplyIntegrationResult.warnings` (Pi'ye özgü uyarı metinleri)

| Koşul                                                       | Uyarı metni                                                                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents.length > 0`                                         | `"Pi has no native agent/persona format. Agents are being written as skills instead. For native .pi/agents/ support, install the community 'pi-subagents' extension: pi install npm:pi-subagents"` |
| `mcpServers.length > 0` VE `pi-mcp-adapter` tespit edilmedi | `"Pi has no native MCP configuration surface. MCP servers were not applied. For MCP support, install the community 'pi-mcp-adapter' extension: pi install npm:pi-mcp-adapter"`                     |
| `mcpServers.length > 0` VE `pi-mcp-adapter` tespit edildi   | Uyarı YOK — `.mcp.json`/`<userRoot>/mcp.json`'a yazılır, `message` alanına `"(via pi-mcp-adapter)"` eklenir                                                                                        |
| `model`/`models` desteklenmeyen alan                        | `ModelFrontmatterResolver`'ın ürettiği genel düşürme uyarısı (bkz. 007 data-model.md)                                                                                                              |

## `PiSettingsPackages` (eklenti tespiti girdisi)

`PiAdapter.isPackageInstalled()`'ın okuduğu Pi `settings.json` dosyalarının ilgili dilimi.

| Alan                | Tür                                       | Açıklama                                                                      |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| `packages`          | `Array<{ source?: unknown }>`             | Her eleman kurulu bir Pi paketini temsil eder                                 |
| `packages[].source` | `string` (beklenen: `"npm:<ad>[@sürüm]"`) | Eşleşme kuralı: `source === "npm:<ad>"` VEYA `source.startsWith("npm:<ad>@")` |

**Okuma sırası (proje kapsamı)**: `.pi/settings.json` → bulunamazsa `<userRoot>/settings.json`. **Kullanıcı kapsamı**: yalnızca `<userRoot>/settings.json`.

**Hata toleransı**: Dosya yok / okunamıyor / JSON parse hatası / `packages` dizi değil → `false` (kurulu değil) döner, ASLA throw etmez.

## `ModelCapabilityMatrix` (genişletme)

```ts
pi: {
  command: drop(),
  agent: drop(),
  skill: drop(),
},
```

Diğer platformlarla aynı `ModelCapability` şeklini kullanır (bkz. 007 spec); yeni bir alan/tür eklemez.
