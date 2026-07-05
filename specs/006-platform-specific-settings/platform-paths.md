# Platform Config Directory Reference

**Purpose**: Verified filesystem locations where each supported platform reads its configuration. This is the authoritative reference for the platform-specific settings copy target resolution.

**Verified**: 2026-06-30 via official documentation for each platform.

## Config Directory Mapping

| Platform        | Config Directory          | Override Env Var      | Primary Config File              | Notes                                                                          |
| --------------- | ------------------------- | --------------------- | -------------------------------- | ------------------------------------------------------------------------------ |
| **antigravity** | `~/.gemini/antigravity/`  | —                     | (skills/keybindings)             | Shares Gemini's `~/.gemini/` root; isolated under `antigravity/` subdirectory  |
| **claude**      | `~/.claude/`              | `CLAUDE_CONFIG_DIR`   | `settings.json`                  | Also `~/.claude.json` for MCP servers (outside the directory)                  |
| **codex**       | `~/.codex/`               | `CODEX_HOME`          | `config.toml`                    | Contains `AGENTS.md`, `rules/`, `sessions/`                                    |
| **cursor**      | `.cursor/` (project only) | —                     | `.mdc` files in `.cursor/rules/` | **Global rules live in SQLite DB, not filesystem** — global copy not supported |
| **forgecode**   | `~/forge/`                | `FORGE_CONFIG`        | `.forge.toml`                    | MCP read from project-local `.mcp.json`                                        |
| **gemini**      | `~/.gemini/`              | `GEMINI_CONFIG_DIR`   | `settings.json`                  | Contains `GEMINI.md`, `extensions/`                                            |
| **kilo**        | `~/.config/kilo/`         | XDG standard          | `kilo.jsonc`                     | Project config: `kilo.jsonc` or `.kilo/kilo.jsonc`                             |
| **opencode**    | `~/.config/opencode/`     | `OPENCODE_CONFIG_DIR` | `opencode.json`                  | Project config: `opencode.json` in project root                                |
| **qwen**        | `~/.qwen/`                | —                     | `settings.json`                  | Project config: `.qwen/settings.json`                                          |
| **windsurf**    | `~/.codeium/`             | —                     | (IDE-managed)                    | Ignores `$XDG_CONFIG_HOME`; primarily IDE-extension based                      |

## Path Resolution Rules

### 1. Environment Variable Resolution (REQUIRED)

Five platforms support custom config directories via environment variables. The apply command **MUST** resolve these before falling back to defaults:

```text
CLAUDE_CONFIG_DIR  → overrides ~/.claude/
CODEX_HOME         → overrides ~/.codex/
GEMINI_CONFIG_DIR  → overrides ~/.gemini/ (also affects antigravity)
OPENCODE_CONFIG_DIR → overrides ~/.config/opencode/
FORGE_CONFIG       → overrides ~/forge/
```

**Resolution order**:

1. Platform-specific env var (if set)
2. `HOME`-relative default path

### 2. Home Directory Resolution

`~` MUST resolve to:

- **Linux/macOS**: `$HOME`
- **Windows**: `%USERPROFILE%`

### 3. XDG Compliance (kilo, opencode)

Two platforms follow XDG Base Directory specification. For these, the system should also check `$XDG_CONFIG_HOME` if set:

- kilo: `$XDG_CONFIG_HOME/kilo/` or `~/.config/kilo/`
- opencode: `$XDG_CONFIG_HOME/opencode/` or `~/.config/opencode/`

## Critical Design Constraints

### Constraint 1: Cursor Global Rules Are NOT Filesystem-Based

Cursor stores **global** user rules in a SQLite database, not a config directory. Only project-scoped rules (`.cursor/rules/*.mdc`) live on the filesystem.

**Implication**: Platform-specific settings for `cursor` can only target **project-local** `.cursor/` directories. Global cursor rule sync is out of scope for this feature.

### Constraint 2: Antigravity Shares Gemini's Root

Antigravity's config lives at `~/.gemini/antigravity/` — a subdirectory of Gemini's config root. Copying settings for both `gemini` and `antigravity` in one operation requires careful path isolation to avoid `antigravity/` content leaking into gemini's top-level.

### Constraint 3: Forge & Cursor Prefer Project-Local Config

`forgecode` (`~/forge/.forge.toml`) and `cursor` (`.cursor/rules/`) treat project-local config as primary. For these platforms, "apply" may need to target either the global config dir or the project root depending on user intent. **Decision needed** in implementation: default to global config dir per the user's clarification ("copy to platform config directory").

## Platform Path Resolution Function (Pseudocode)

```typescript
function resolvePlatformConfigPath(platform: SupportedApplyPlatform): string {
  const home = process.env.HOME || process.env.USERPROFILE;

  switch (platform) {
    case "claude":
      return process.env.CLAUDE_CONFIG_DIR ?? `${home}/.claude`;
    case "codex":
      return process.env.CODEX_HOME ?? `${home}/.codex`;
    case "gemini":
      return process.env.GEMINI_CONFIG_DIR ?? `${home}/.gemini`;
    case "antigravity":
      return `${resolvePlatformConfigPath("gemini")}/antigravity`;
    case "opencode":
      return (process.env.OPENCODE_CONFIG_DIR ?? process.env.XDG_CONFIG_HOME)
        ? `${process.env.XDG_CONFIG_HOME}/opencode`
        : `${home}/.config/opencode`;
    case "kilo":
      return process.env.XDG_CONFIG_HOME ? `${process.env.XDG_CONFIG_HOME}/kilo` : `${home}/.config/kilo`;
    case "qwen":
      return `${home}/.qwen`;
    case "windsurf":
      return `${home}/.codeium`;
    case "forgecode":
      return process.env.FORGE_CONFIG ?? `${home}/forge`;
    case "cursor":
      // SPECIAL: only project-local supported; see Constraint 1
      throw new Error("Cursor requires project-local target, not global config dir");
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
```

## Sources

- [Claude Code .claude directory](https://code.claude.com/docs/en/claude-directory)
- [Cursor Rules documentation](https://cursor.com/docs/rules)
- [Gemini CLI configuration](https://geminicli.com/docs/reference/configuration/)
- [Codex config basics](https://developers.openai.com/codex/config-basic)
- [Windsurf/Codeium config directory](https://github.com/Exafunction/codeium/issues/40)
- [OpenCode config](https://opencode.ai/docs/config/)
- [Kilo Code settings](https://kilo.ai/docs/getting-started/settings)
- [Qwen Code configuration](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/)
- [Google Antigravity settings](https://antigravity.google/docs/settings)
- [ForgeCode $FORGE_CONFIG](https://forgecode.dev/docs/forge-config/)

## Verification Status

- ✅ All 10 paths verified against official documentation (2026-06-30)
- ✅ Environment variable overrides documented for 5 platforms
- ⚠️ Cursor global rules limitation flagged (Constraint 1)
- ⚠️ Antigravity/Gemini path overlap flagged (Constraint 2)
- ⚠️ Forge/Cursor project-local preference flagged (Constraint 3)
