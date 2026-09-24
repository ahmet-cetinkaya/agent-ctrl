# Quickstart: Pi Platform Support

## Senaryo 1 — Otomatik test takımı (birincil doğrulama)

```bash
bun test tests/unit/infrastructure/Features/adapters/PiAdapter.test.ts
bun test tests/contract/cli/PlatformCustomizationSurfaceContract.test.ts
bun test
bunx tsc --noEmit
```

**Beklenen**: Tümü hatasız geçer; mevcut 10 platformun testleri değişmeden geçer (SC-004).

## Senaryo 2 — Proje kapsamında uçtan uca apply (elle)

```bash
cd /path/to/some/project
mkdir -p rules skills/git-workflow commands agents mcps
echo "# Coding Style" > rules/coding-style.md
printf '%s\n' '---' 'name: git-workflow' 'description: Use scoped commits' '---' '' 'Body' > skills/git-workflow/SKILL.md
echo "# Fix Lint" > commands/fix-lint.md
echo "# Architect" > agents/architect.md

agent-ctrl apply pi
```

**Beklenen**:

- `AGENTS.md` proje kökünde oluşur ve kural içeriğini yönetilen bölümde içerir.
- `.pi/prompts/fix-lint.md` oluşur, frontmatter'ında `description` bulunur.
- `.pi/skills/git-workflow/SKILL.md` bire bir kopyalanır.
- `.pi/skills/architect/SKILL.md` oluşur; sonuç uyarılarında "Agents are being written as skills instead." bulunur.
- MCP sunucusu varsa VE `pi-mcp-adapter` kurulu değilse: hiçbir dosya yazılmaz; "MCP servers were not applied" uyarısı görünür (kurulu ise bkz. Senaryo 6).

## Senaryo 3 — Kullanıcı kapsamı (elle)

```bash
agent-ctrl apply pi --scope user
```

**Beklenen**: `~/.pi/agent/AGENTS.md`, `~/.pi/agent/prompts/`, `~/.pi/agent/skills/` oluşur/güncellenir.

## Senaryo 4 — Model frontmatter düşürme (elle)

1. Bir komuta `model: anthropic/claude-sonnet-4-5` frontmatter alanı ekle.
2. `agent-ctrl apply pi` çalıştır.
3. `.pi/prompts/<ad>.md` içinde `model` alanının bulunmadığını, sonuç uyarılarında gerekçenin yer aldığını doğrula.

## Senaryo 5 — `--override` ile temizleme (elle)

1. `agent-ctrl apply pi` çalıştır.
2. `.pi/prompts/` içine elle bir dosya ekle (`_temp.md`).
3. `agent-ctrl apply pi --override` çalıştır.
4. `_temp.md`'nin silindiğini, yönetilen dosyaların yeniden yazıldığını doğrula.

## Senaryo 6 — `pi-mcp-adapter` tespit edilince MCP fiilen uygulanır (elle)

```bash
mkdir -p .pi
echo '{"packages":[{"source":"npm:pi-mcp-adapter"}]}' > .pi/settings.json
mkdir -p mcps
echo '{"mcpServers":{"context7":{"command":"npx","args":["-y","@upstash/context7-mcp"]}}}' > mcps/context7.json

agent-ctrl apply pi
```

**Beklenen**:

- `.mcp.json` oluşur, `context7` sunucusunu `{ "mcpServers": { "context7": {...} } }` biçiminde içerir.
- Sonuç mesajında "(via pi-mcp-adapter)" ifadesi bulunur.
- "MCP servers were not applied" uyarısı YOKTUR.
- `.pi/settings.json`'daki `source` değeri `npm:some-other-package` gibi ilgisiz bir paketse veya dosya bozuk JSON içeriyorsa: davranış Senaryo 2'deki fallback ile birebir aynıdır (regresyon yok).
