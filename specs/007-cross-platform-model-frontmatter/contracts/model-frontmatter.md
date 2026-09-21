# Contract: Model Frontmatter Fields

Kullanıcı tarafından yazılan artifact frontmatter alanları ve platform çıktı sözleşmesi. Bu, aracın dış arabirimidir (kullanıcı dokümantasyonunun normatif kaynağı).

## Girdi alanları (artifact frontmatter)

| Alan     | Tür                | Zorunlu | Açıklama                                                                                     |
| -------- | ------------------ | ------- | -------------------------------------------------------------------------------------------- |
| `model`  | string             | Hayır   | Kanonik model değeri; önerilen biçim `provider/model-id` (ör. `anthropic/claude-sonnet-4-5`) |
| `models` | map<string,string> | Hayır   | Platforma özel override'lar; anahtarlar desteklenen platform adları (ör. `qwen: fast`)       |

**Öncelik**: `models.<hedef-platform>` > `model` > (alan yok → hiçbir işlem yapılmaz).

**Kısıtlar**:

- `models` haritası hedef platform dosyalarına asla yazılmaz.
- `models` içindeki bilinmeyen platform anahtarı veya dize olmayan değer → uyarı, değer yok sayılır.
- Bozuk YAML frontmatter → içerik değiştirilmez, uyarı üretilir, apply devam eder.

## Çıktı sözleşmesi (platform hedef dosyaları)

| Platform    | Command çıktısı                  | Agent çıktısı                                                                | Skill çıktısı                    |
| ----------- | -------------------------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| Claude      | `model: <id-sans-önek>`          | `model: <id-sans-önek>`                                                      | `model: <değer>` (kopya korunur) |
| OpenCode    | `model: <değer>`                 | `model: <değer>`                                                             | yazılmaz + uyarı                 |
| Kilo        | yazılmaz + uyarı (command→skill) | `model: <değer>`                                                             | yazılmaz + uyarı                 |
| ForgeCode   | yazılmaz + uyarı                 | `model: <id>`, `provider: <provider>`                                        | yazılmaz + uyarı                 |
| Qwen        | yazılmaz + uyarı                 | yalnız `models.qwen` override'ı (`model: <override>`); genel `model` → uyarı | yazılmaz + uyarı                 |
| Codex       | yazılmaz + uyarı (command→skill) | TOML `model = "<değer>"`                                                     | yazılmaz + uyarı                 |
| Cursor      | yazılmaz + uyarı                 | yazılmaz + uyarı                                                             | yazılmaz + uyarı                 |
| Gemini      | yazılmaz + uyarı (TOML komut)    | desteklenmiyor (uyarı)                                                       | yazılmaz + uyarı                 |
| Windsurf    | yazılmaz + uyarı                 | yazılmaz + uyarı                                                             | yazılmaz + uyarı                 |
| Antigravity | yazılmaz + uyarı                 | desteklenmiyor (uyarı)                                                       | yazılmaz + uyarı                 |

Not: `<değer>` = kaynak değeri dönüştürmeden; `<id-sans-önek>` = `provider/` öneki kaldırılmış değer (öneksiz değerler aynen korunur); `<id>`/`<provider>` = `provider/model-id` değerinin bölünmüş hâli.

## Uyarı mesaj sözleşmesi

Her düşürme/yok sayma, şu bilgileri içeren tek bir uyarı üretir (uygulama dili İngilizce):

- hangi artifact (id/dosya adı),
- hangi alan (`model` / `models.<platform>`),
- neden düşürüldüğü (platform/yüzey desteklemiyor / override gerekli / geçersiz anahtar),
- gerekiyorsa önerilen aksiyon (ör. "override via `models.<platform>`").

Uyarılar `apply` / `profile apply` sonuçlarının mevcut warnings bölümünde gösterilir.
