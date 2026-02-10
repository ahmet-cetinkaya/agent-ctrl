# Command Reference

## Global Workflow Commands

### `init [template]`

Scaffold a new project, optionally from a remote Git template.

```bash
# Create empty project
agent-ctrl init

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

Deploy local artifacts to a target agent environment.

```bash
# Apply to Claude Code
agent-ctrl apply claude

# Apply to Gemini
agent-ctrl apply gemini

# Apply to Cursor
agent-ctrl apply cursor

# Apply to generic MCP
agent-ctrl apply mcp
```

**Behavior:**

- Scans local artifacts (`rules/`, `skills/`, `commands/`, `agents/`)
- Transforms using platform-specific adapter
- Writes to target platform's configuration location

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
# Add a skill
agent-ctrl skill add git-workflow

# Add from SkillsMP
agent-ctrl skill add skillsmp:code-review

# Search SkillsMP
agent-ctrl skill search "testing"

# List installed skills
agent-ctrl skill ls

# Remove a skill
agent-ctrl skill rm git-workflow

# Update a skill
agent-ctrl skill update git-workflow
```

**Location:** `skills/`

**Integrations:** SkillsMP marketplace

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
# Interactive MCP setup
agent-ctrl mcp setup

# Validate mcp.json
agent-ctrl mcp validate

# List configured servers
agent-ctrl mcp ls
```

**Location:** `mcp.json`

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
