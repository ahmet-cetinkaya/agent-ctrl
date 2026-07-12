# Command Reference

## Global Workflow Commands

### `init [path]`

Initialize the agent-ctrl global configuration structure.

```bash
# Create default config in ~/.agent-ctrl
agent-ctrl init

# Create config in custom location
agent-ctrl init /path/to/config

# Re-initialize an existing config root (overwrites if exists)
agent-ctrl init --override
```

**Behavior:**

- Creates standard directory structure (`rules/`, `skills/`, `commands/`, `agents/`, `mcps/`)
- Creates `.env`, `.env.example`, and `.gitignore` for credentials
- Fails if directory exists unless `--override` is specified

---

### `apply [target]`

Sync `.agent-ctrl` artifacts into one selected platform's native configuration.

```bash
# Apply to OpenCode
agent-ctrl apply opencode

# Apply to Claude Code
agent-ctrl apply claude

# Apply to Gemini CLI
agent-ctrl apply gemini

# Apply to Qwen Code
agent-ctrl apply qwen

# Apply to Kilo
agent-ctrl apply kilo

# Apply to Antigravity
agent-ctrl apply antigravity

# Apply to Codex CLI
agent-ctrl apply codex

# Apply to Cursor
agent-ctrl apply cursor

# Apply to Windsurf
agent-ctrl apply windsurf

# Apply to Forge Code
agent-ctrl apply forgecode
```

**Behavior:**

- Processes exactly one platform per command run
- Uses global/user scope by default when the platform documents a file-backed user configuration surface
- Uses each platform's documented default user root when no custom `--path` is provided
- Syncs rules, commands, skills, agents, and MCP servers into the selected platform's native configuration surface
- Preserves unrelated user-defined configuration entries
- Reports deterministic selected-platform status (`success`, `unchanged`, `failure`)
- Returns a successful command exit for `success` and `unchanged`

**Options:**

```bash
# Dry run without writing files
agent-ctrl apply gemini --dry-run

# Force replacement of conflicting managed content
agent-ctrl apply cursor --override

# Apply to project-based configuration in current folder
agent-ctrl apply qwen --project

# Apply to documented global/user configuration
agent-ctrl apply codex

# Use a custom platform user configuration root
agent-ctrl apply opencode --path /custom/opencode
```

---

## Artifact Management

Each artifact type supports `add`, `ls`, and `rm` operations.

### Rule Management

```bash
# Add a rule
agent-ctrl rule add coding-style

# List all rules
agent-ctrl rule ls

# Remove a rule
agent-ctrl rule rm security

# Add rule from URL
agent-ctrl rule add https://example.com/rule.md
```

**Location:** `rules/`

---

### Skill Management

```bash
# Seed or refresh a SkillsMP discovery scope
agent-ctrl skill sync --query "code review"

# Override the SkillsMP API key for one run
agent-ctrl skill sync --query "code review" --api-key "$SKILLSMP_API_KEY"

# Search synchronized SkillsMP entries
agent-ctrl skill search "testing" --capability review

# Activate a managed skill from SkillsMP
agent-ctrl skill add skillsmp:code-review

# List installed skills plus managed catalog metadata
agent-ctrl skill ls

# Deactivate a managed skill
agent-ctrl skill rm code-review

# Update a single managed skill or all managed skills
agent-ctrl skill update code-review
agent-ctrl skill update --all --refresh
```

**Location:** `skills/`

**Integrations:** SkillsMP marketplace, cached under `.agent-ctrl/.catalog/`

**Credentials:** Loaded from `.agent-ctrl/.env` by default. `--api-key` overrides the configured key for a single command.

---

### Command Management

```bash
# List all commands
agent-ctrl command ls
```

**Location:** `commands/`

---

### Agent Management

```bash
# List agents
agent-ctrl agent ls
```

**Location:** `agents/`

---

### MCP Management

```bash
# Refresh the Smithery registry cache
agent-ctrl mcp sync

# Override the Smithery API key for one run
agent-ctrl mcp sync --api-key "$SMITHERY_API_KEY"

# Search synchronized Smithery servers
agent-ctrl mcp search github --status unknown

# Activate and deactivate managed MCPs
agent-ctrl mcp add smithery:github
agent-ctrl mcp rm github

# List configured servers with managed catalog metadata
agent-ctrl mcp ls

# Update one managed MCP or all managed MCPs
agent-ctrl mcp update github
agent-ctrl mcp update --all --refresh
```

**Location:** `.agent-ctrl/mcps/`

**Credentials:** Loaded from `.agent-ctrl/.env` by default. `--api-key` overrides the configured key for a single command.

---

### Profile Management

Profiles allow you to define and apply specific sets of artifacts to platforms.

```bash
# List available profiles (grouped by category, with description and tags)
agent-ctrl profile list

# Apply a profile to a platform
agent-ctrl profile apply default --platform opencode

# Apply a profile with dry run
agent-ctrl profile apply default --platform claude --dry-run

# Apply a profile with override
agent-ctrl profile apply production --platform cursor --override
```

**Location:** `profiles/`

**Metadata:** Each profile directory can optionally define a `profile.yaml` with `name`, `description`, and `tags`. The first tag is used as the profile's category, and `profile list` / the interactive `profile apply` picker group profiles by category (profiles without metadata are grouped under `Uncategorized`). See [Configuration → Profiles](./CONFIGURATION.md#profiles-profiles) for the file format.

---

### `version`

Display version information.

```bash
agent-ctrl --version
agent-ctrl -v
```

**Note:** The CLI is installed as both `agent-ctrl` and `agent-ctrl-cli` binaries.

### `help`

Display help information.

```bash
# General help
agent-ctrl --help
agent-ctrl -h

# Command-specific help
agent-ctrl skill --help
agent-ctrl apply --help
```

---

## Output Options

All commands support common output flags:

```bash
# Verbose output
agent-ctrl apply claude --verbose

# Quiet mode
agent-ctrl skill add testing --quiet

# JSON output
agent-ctrl rule ls --json
```

---

## Exit Codes

| Code | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| 0    | Success                                                         |
| 1    | User error (invalid input, missing credentials, file not found) |
| 2    | System/validation error (internal failure, unexpected state)    |
