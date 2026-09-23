# Contract: Pi Platform Adapter

## `IApplyPlatformAdapter` uyumu

`PiAdapter`, `src/core/domain/shared/interfaces/IPlatformAdapter.ts`'teki `IApplyPlatformAdapter` sözleşmesini uygular:

- `platformName: "pi"`
- `resolveTarget(projectPath, request?) → ApplyConfigTarget`
- `applyApplyIntegration(request) → ApplyIntegrationResult`

## Artifact → hedef eşlemesi

| Artifact   | Pi desteği | Hedef (proje)              | Hedef (kullanıcı)                  | Dönüşüm                                                |
| ---------- | ---------- | -------------------------- | ---------------------------------- | ------------------------------------------------------ |
| rules      | ✅ native  | `AGENTS.md`                | `~/.pi/agent/AGENTS.md`            | Yönetilen bölüm (marker) upsert                        |
| commands   | ✅ native  | `.pi/prompts/<ad>.md`      | `~/.pi/agent/prompts/<ad>.md`      | Düzleştirilmiş dosya adı + `description` frontmatter   |
| skills     | ✅ native  | `.pi/skills/<id>/SKILL.md` | `~/.pi/agent/skills/<id>/SKILL.md` | Birebir kopya (+ assets), frontmatter normalize edilir |
| agents     | ❌ yok     | `.pi/skills/<id>/SKILL.md` | `~/.pi/agent/skills/<id>/SKILL.md` | Skill'e dönüştürülür + uyarı                           |
| mcpServers | ❌ yok     | —                          | —                                  | Uygulanmaz, yalnızca uyarı                             |

## Model frontmatter sözleşmesi

`ModelCapabilityMatrix["pi"]` her üç artifact türü için `{ support: "drop", transform: "passthrough", requiresOverride: false }` döndürür. `models.pi` override'ı da (drop capability olduğundan) bir uyarıyla düşürülür — 007 özelliğindeki genel "override for a drop target → warning, dropped" kuralı geçerlidir.

## Sözleşme testi

`tests/contract/cli/PlatformCustomizationSurfaceContract.test.ts`, `registry.listSupportedPlatforms()` üzerinden Pi'yi de dolaşır ve varsayılan (scope argümanı verilmeden) `resolveTarget()` çağrısının şu değerleri döndürdüğünü doğrular:

```ts
pi: { path: resolve(homedir(), ".pi", "agent", "AGENTS.md"), scope: "user" }
```
