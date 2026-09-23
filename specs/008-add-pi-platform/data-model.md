# Data Model: Pi Platform Support

Bu özellik yeni bir çekirdek veri türü tanımlamaz; mevcut platform-adaptörü sözleşmesinin Pi için bir örneğini ekler ve mevcut `ModelCapabilityMatrix` tablosuna bir satır ekler (bkz. `specs/007-cross-platform-model-frontmatter/data-model.md` — `ModelCapability` orada tanımlıdır).

## `SupportedApplyPlatform` (genişletme)

`src/core/domain/shared/types/SupportedApplyPlatform.ts` içindeki kapalı union'a `"pi"` eklenir; `PLATFORM_DISPLAY_NAMES["pi"] = "Pi"`.

**İnvariant**: `PlatformAdapterRegistry`'nin constructor doğrulaması (`ADAPTER_NOT_REGISTERED`), bu union'a eklenen her platformun bir factory'e sahip olmasını zorunlu kılar — bu yüzden `SupportedApplyPlatform` genişletmesi ve `PiAdapter` factory kaydı ATOMİK olarak birlikte yapılmalıdır.

## `ApplyConfigTarget` (Pi örneği)

| Alan         | Proje kapsamı değeri                | Kullanıcı kapsamı değeri (varsayılan)      |
| ------------ | ------------------------------------ | ------------------------------------------- |
| `configPath` | `<projectPath>/AGENTS.md`            | `~/.pi/agent/AGENTS.md`                     |
| `scope`      | `"project"`                          | `"user"` (varsayılan kapsam — diğer platformlarla tutarlı) |
| `surface`    | `"pi-agents-md-prompts-skills"`      | `"pi-agents-md-prompts-skills"`             |

## `ApplyIntegrationResult.warnings` (Pi'ye özgü uyarı metinleri)

| Koşul                              | Uyarı metni                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `agents.length > 0`                 | `"Pi does not support custom agents. Agents are being written as skills instead."`   |
| `mcpServers.length > 0`             | `"Pi does not support MCP server configuration. MCP servers will not be applied."`   |
| `model`/`models` desteklenmeyen alan | `ModelFrontmatterResolver`'ın ürettiği genel düşürme uyarısı (bkz. 007 data-model.md) |

## `ModelCapabilityMatrix` (genişletme)

```ts
pi: {
  command: drop(),
  agent: drop(),
  skill: drop(),
},
```

Diğer platformlarla aynı `ModelCapability` şeklini kullanır (bkz. 007 spec); yeni bir alan/tür eklemez.
