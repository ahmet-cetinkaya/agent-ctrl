# Contract: Pi Platform Adapter

## `IApplyPlatformAdapter` uyumu

`PiAdapter`, `src/core/domain/shared/interfaces/IPlatformAdapter.ts`'teki `IApplyPlatformAdapter` sözleşmesini uygular:

- `platformName: "pi"`
- `resolveTarget(projectPath, request?) → ApplyConfigTarget`
- `applyApplyIntegration(request) → ApplyIntegrationResult`

## Artifact → hedef eşlemesi

| Artifact   | Pi desteği          | Hedef (proje)                                                                                    | Hedef (kullanıcı)                                                                                                | Dönüşüm                                                                                                      |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| rules      | ✅ native           | `AGENTS.md`                                                                                      | `~/.pi/agent/AGENTS.md`                                                                                          | Yönetilen bölüm (marker) upsert                                                                              |
| commands   | ✅ native           | `.pi/prompts/<ad>.md`                                                                            | `~/.pi/agent/prompts/<ad>.md`                                                                                    | Düzleştirilmiş dosya adı + `description` frontmatter                                                         |
| skills     | ✅ native           | `.pi/skills/<id>/SKILL.md`                                                                       | `~/.pi/agent/skills/<id>/SKILL.md`                                                                               | Birebir kopya (+ assets), frontmatter normalize edilir                                                       |
| agents     | ⚠️ eklenti-tespitli | `.pi/agents/<id>.md` (yalnızca `pi-subagents` tespit edilirse), yoksa `.pi/skills/<id>/SKILL.md` | `~/.pi/agent/agents/<id>.md` (yalnızca `pi-subagents` tespit edilirse), yoksa `~/.pi/agent/skills/<id>/SKILL.md` | Tespit edilirse `name`/`description` frontmatter (`PiAgentRenderer`); edilmezse skill'e dönüştürülür + uyarı |
| mcpServers | ⚠️ eklenti-tespitli | `.mcp.json` (yalnızca `pi-mcp-adapter` tespit edilirse)                                          | `~/.pi/agent/mcp.json` (yalnızca `pi-mcp-adapter` tespit edilirse)                                               | Tespit edilirse standart `mcpServers` biçimi (`PiMcpConfigRenderer`); edilmezse uygulanmaz + uyarı           |

### MCP eklenti tespiti sözleşmesi

`PiAdapter.isPackageInstalled("pi-mcp-adapter", ...)`:

1. Proje kapsamı: `.pi/settings.json` VE `<userRoot>/settings.json` içindeki `packages[].source` alanlarını kontrol eder (OR — herhangi biri eşleşirse yeterli). Kullanıcı kapsamı: yalnızca `<userRoot>/settings.json`.
2. Eşleşme: `source === "npm:pi-mcp-adapter"` veya `source.startsWith("npm:pi-mcp-adapter@")`.
3. Dosya yok / bozuk JSON / `packages` alanı dizi değil → `false` döner, apply akışını kesmez.
4. `true` dönerse: `mergeJsonObjectFile(mcpConfigPath, (existing) => renderPiMcpConfig(existing, servers), dryRun)` çağrılır; `mcpConfigPath` = proje: `resolve(projectPath, ".mcp.json")`, kullanıcı: `resolve(userRoot, "mcp.json")`.

### Agent eklenti tespiti sözleşmesi

`PiAdapter.isPackageInstalled("pi-subagents", ...)` — Karar 9'daki AYNI genel yardımcı fonksiyon, farklı paket adıyla:

1. Tespit kuralları MCP ile birebir aynıdır (bkz. "MCP eklenti tespiti sözleşmesi").
2. `true` dönerse: `syncAgentsAsMarkdown(agents, agentsRoot, dryRun, true, new PiAgentRenderer(), "pi")` çağrılır; `agentsRoot` = proje: `resolve(projectPath, ".pi", "agents")`, kullanıcı: `resolve(userRoot, "agents")`.
3. `PiAgentRenderer`, `name`'i her zaman gerçek agent id'siyle günceller (pi-subagents `name` alanını zorunlu kılar); `description` yalnızca eksikse eklenir (mevcut kullanıcı değeri asla ezilmez); diğer tüm alanlar (`tools`, `model`, `systemPromptMode`, ...) aynen korunur.
4. `false` dönerse: mevcut `syncAgentsAsSkills(agents, skillsRoot, dryRun, "pi")` fallback'i değişmeden çalışır.

## Model frontmatter sözleşmesi

`ModelCapabilityMatrix["pi"]` her üç artifact türü için `{ support: "drop", transform: "passthrough", requiresOverride: false }` döndürür. `models.pi` override'ı da (drop capability olduğundan) bir uyarıyla düşürülür — 007 özelliğindeki genel "override for a drop target → warning, dropped" kuralı geçerlidir.

## Sözleşme testi

`tests/contract/cli/PlatformCustomizationSurfaceContract.test.ts`, `registry.listSupportedPlatforms()` üzerinden Pi'yi de dolaşır ve varsayılan (scope argümanı verilmeden) `resolveTarget()` çağrısının şu değerleri döndürdüğünü doğrular:

```ts
pi: { path: resolve(homedir(), ".pi", "agent", "AGENTS.md"), scope: "user" }
```
