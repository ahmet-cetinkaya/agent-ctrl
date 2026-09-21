# Data Model: Cross-Platform Model Frontmatter

## `ModelCapability`

Capability matrisi içindeki, bir platformun tek artifact türündeki davranışını tanımlar.

| Alan               | Tür                                        | Açıklama                                                                     |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `support`          | `set` \| `drop`                            | Çözülmüş modelin hedef dosyaya yazılıp yazılamayacağı                        |
| `transform`        | `passthrough` \| `prefix-strip` \| `split` | Değerin hedef biçime dönüştürülme kuralı                                     |
| `requiresOverride` | boolean                                    | Genel `model` değeri yerine explicit `models.<platform>` gerekip gerekmediği |

**İnvariantlar**:

- Model ID/sürüm listesi taşımaz.
- Platform anahtarları `SUPPORTED_APPLY_PLATFORMS` ile sınırlıdır.
- `drop` capability'si model değerini hedefe asla yazmaz.

## `ModelFrontmatterInput`

Bir artifact frontmatter'ından çıkarılan, yalnızca agent-ctrl'e ait model yapılandırması.

| Alan           | Tür                                    | Açıklama                                                           |
| -------------- | -------------------------------------- | ------------------------------------------------------------------ |
| `model`        | `string \| undefined`                  | Kanonik genel model değeri; önerilen biçim `provider/model-id`     |
| `models`       | `Record<string, unknown> \| undefined` | Platforma özel override haritası; her geçerli değer dize olmalıdır |
| `platform`     | `SupportedApplyPlatform`               | Apply çalıştırılan hedef platform                                  |
| `artifactKind` | `command` \| `agent` \| `skill`        | Değeri kullanan gerçek hedef artifact yüzeyi                       |

**İnvariantlar**:

- `models.<platform>` varsa genel `model` değerinden önceliklidir.
- `models` hedefe taşınmaz.
- `models` içindeki bilinmeyen platform anahtarı veya dize olmayan değer warning üretir.

## `ModelResolution`

Resolver'ın saf ve deterministik sonucudur.

| Alan       | Tür                         | Açıklama                                       |
| ---------- | --------------------------- | ---------------------------------------------- |
| `action`   | `absent` \| `set` \| `drop` | Model alanı için hedef işlemi                  |
| `value`    | `string \| undefined`       | Dönüştürülmüş model değeri (`set` için)        |
| `provider` | `string \| undefined`       | Yalnız `split` dönüşümünde yazılacak sağlayıcı |
| `warnings` | `string[]`                  | Kullanıcıya gösterilecek işlem açıklamaları    |

**State transition**:

```text
frontmatter yok veya model/models yok ───────────────→ absent
model/models var + capability set ───────────────────→ set
model/models var + capability drop ──────────────────→ drop + warning
model var + requiresOverride ────────────────────────→ drop + override-required warning
models.<platform> var + capability set ──────────────→ set (override wins)
bozuk YAML ──────────────────────────────────────────→ source unchanged + warning (resolution uygulanmaz)
```

## `FrontmatterModelTransformResult`

Infrastructure transformer çıktısıdır.

| Alan       | Tür        | Açıklama                                                               |
| ---------- | ---------- | ---------------------------------------------------------------------- |
| `content`  | `string`   | Hedefe verilecek markdown; `models` kaldırılmış, resolution uygulanmış |
| `warnings` | `string[]` | Resolver ve YAML parse uyarıları                                       |

**Koruma kuralları**:

- Frontmatter dışındaki body baytları değiştirilmez.
- `model`, `models` ve gerektiğinde `provider` dışındaki tüm frontmatter alanları korunur.
- Frontmatter yoksa kaynak içerik aynen döner.
