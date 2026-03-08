# Command Reference

## Global Workflow Commands

### `init [template]`

Scaffold a new project, optionally from a remote Git template.

```bash
# Create empty project
agent-ctrl init

# Re-initialize an existing config root
agent-ctrl init --override

# Clone from GitHub template
agent-ctrl init owner/repo

# Clone from GitLab
agent-ctrl init gitlab:owner/repo

# Clone from Bitbucket
agent-ctrl init bitbucket:owner/repo
```

**Behavior:**

- Creates standard directory structure (`rules/`, `skills/`, `commands/`, `agents/`)
- Fetches remote template using `giget`
- Removes `.git` history from templates
- Prompts for variable substitution (e.g., `{{ PROJECT_NAME }}`)

---

### `apply [target]`

Apply managed `appy` integration to one selected platform.

```bash
# Apply to OpenCode
agent-ctrl apply opencode

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
```

**Behavior:**

- Processes exactly one platform per command run
- Uses global user configuration target by default
- Uses `~/.agent-ctrl` as the default user configuration root
- Creates or replaces managed `appy` integration at the selected platform configuration surface
- Preserves unrelated user-defined configuration entries
- Reports deterministic selected-platform status (`success`, `unchanged`, `failure`)
- Returns a successful command exit for `success` and `unchanged`

**Options:**

```bash
# Dry run without writing files
agent-ctrl apply gemini --dry-run

# Force replacement of conflicting managed appy entry
agent-ctrl apply cursor --override

# Apply to project-based configuration in current folder
agent-ctrl apply qwen --project

# Use a custom user configuration root path instead of ~/.agent-ctrl
agent-ctrl apply opencode --path /custom/agent-ctrl
```

---

### `build [target]`

Generate static configuration files without applying.

```bash
# Build for Claude Code
agent-ctrl build claude --output dist/claude-config.json

# Build for Cursor
agent-ctrl build cursor --output dist/.cursorrules
```

**Behavior:**

- Same transformation as `apply`
- Outputs to specified file instead of platform location
- Useful for CI/CD pipelines and review

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

# Add a command
agent-ctrl command add explain

# Add to subdirectory
agent-ctrl command add dev/fix-lint

# Remove a command
agent-ctrl command rm explain
```

**Location:** `commands/`

**Note:** Supports recursive subdirectories for organization

---

### Agent Management

```bash
# Add an agent persona
agent-ctrl agent add architect

# List agents
agent-ctrl agent ls

# Remove an agent
agent-ctrl agent rm senior-dev
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

## Utility Commands

### `validate`

Validate all artifacts and configuration.

```bash
# Validate all
agent-ctrl validate

# Validate specific artifact type
agent-ctrl validate rules
agent-ctrl validate skills
```

### `version`

Display version information.

```bash
agent-ctrl --version
agent-ctrl -v
```

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

| Code | Meaning                       |
| ---- | ----------------------------- |
| 0    | Success                       |
| 1    | General error                 |
| 2    | Validation error              |
| 3    | Network error (SkillsMP, Git) |
| 4    | File system error             |
| 5    | Configuration error           |
