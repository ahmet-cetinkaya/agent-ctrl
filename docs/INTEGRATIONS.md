# Integrations

## SkillsMP Integration

### Overview

SkillsMP is a marketplace for discovering and sharing AI agent skills. agent-ctrl integrates with SkillsMP to enable seamless skill discovery, installation, and updates.

### Discovery

```bash
# Refresh a query-based discovery scope
agent-ctrl skill sync --query "testing"

# Refresh a category-based discovery scope
agent-ctrl skill sync --category "productivity"

# Use AI-powered search when supported
agent-ctrl skill sync --query "code review" --ai

# Override the SkillsMP API key for one command
agent-ctrl skill sync --query "testing" --api-key "$SKILLSMP_API_KEY"

# Force refresh even if cache is fresh
agent-ctrl skill sync --query "testing" --refresh
```

### Installation

```bash
# Install by ID
agent-ctrl skill add skillsmp:code-review

# Install specific version
agent-ctrl skill add skillsmp:git-workflow@1.2.0
```

**Behavior:**

1. Uses the synchronized catalog state when available
2. Fetches `SKILL.md` or installation metadata when needed
3. Creates `skills/<id>/` directory
4. Tracks source for updates
5. Validates SKILL.md standard

### Updates

```bash
# Update specific skill
agent-ctrl skill update git-workflow

# Update all installed skills
agent-ctrl skill update --all

# Refresh before checking updates
agent-ctrl skill update --all --refresh
```

### Search

```bash
# Search the synchronized cache
agent-ctrl skill search "web" --capability development
```

### Credentials

- `agent-ctrl init` creates `.agent-ctrl/.env`, `.agent-ctrl/.env.example`, and `.agent-ctrl/.gitignore`.
- SkillsMP commands load `SKILLSMP_API_KEY` or `SKILLSMP_TOKEN` from `.agent-ctrl/.env`.
- `--api-key` overrides the configured value for the current command only.

### Skill Metadata

Installed skills track their source:

```json
{
  "source": "skillsmp:code-review",
  "version": "1.0.0",
  "installedAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-20T15:30:00Z"
}
```

---

## Smithery Integration

### Overview

Smithery provides the MCP registry used for discovery and managed MCP activation.

### Discovery

```bash
# Refresh the cached Smithery registry
agent-ctrl mcp sync

# Refresh with a scoped query
agent-ctrl mcp sync --query "github"

# Override the Smithery credential for one command
agent-ctrl mcp sync --api-key "$SMITHERY_API_KEY"

# Force refresh even if cache is fresh
agent-ctrl mcp sync --refresh
```

### Search

```bash
# Search the synchronized registry
agent-ctrl mcp search github --status unknown
```

### Activation

```bash
# Activate a managed MCP from Smithery
agent-ctrl mcp add smithery:github

# Deactivate it later
agent-ctrl mcp rm github
```

### Updates

```bash
# Update one managed MCP
agent-ctrl mcp update github

# Update all managed MCPs with a pre-refresh
agent-ctrl mcp update --all --refresh
```

### Notes

- `agent-ctrl init` creates `.agent-ctrl/.env`, `.agent-ctrl/.env.example`, and `.agent-ctrl/.gitignore`.
- Smithery registry access uses `SMITHERY_API_KEY` or `SMITHERY_TOKEN` from `.agent-ctrl/.env`.
- `--api-key` overrides the configured value for the current command only.
- agent-ctrl stores synchronized catalog state under `.agent-ctrl/catalog/`.
- Managed MCP files remain materialized in `.agent-ctrl/mcps/` so existing MCP loading still works.

---

## Git Template Support

### Overview

Initialize projects from remote Git repositories using `giget` for efficient fetching.

### Supported Platforms

| Platform  | Prefix       | Example                |
| --------- | ------------ | ---------------------- |
| GitHub    | (default)    | `owner/repo`           |
| GitLab    | `gitlab:`    | `gitlab:owner/repo`    |
| Bitbucket | `bitbucket:` | `bitbucket:owner/repo` |
| Sourcehut | `srht:`      | `srht:~owner/repo`     |

### Usage

```bash
# Initialize from GitHub
agent-ctrl init owner/template

# Initialize from GitLab
agent-ctrl init gitlab:owner/template

# Initialize with specific branch
agent-ctrl init owner/template --branch main

# Initialize to subdirectory
agent-ctrl init owner/template --dest ./my-project
```

### Post-Processing

After cloning, the CLI performs:

1. **Git Cleanup:** Removes `.git` directory and history
2. **Variable Substitution:** Prompts for template variables

Example template with variables:

````markdown
# {{ PROJECT_NAME }}

## Setup

```bash
cd {{ PROJECT_NAME }}
npm install
```
````

````

The CLI will prompt for:
- `PROJECT_NAME`: Display name
- `ENV`: Environment (development, production, etc.)

### Custom Templates

Create your own templates by following the standard directory structure:

```text
my-agent-template/
├── rules/
│   └── coding-style.md
├── skills/
│   └── SKILL.md
├── agents/
│   └── senior-dev.md
└── README.md
````

Push to GitHub and share:

```bash
agent-ctrl init yourusername/my-agent-template
```

---

## MCP (Model Context Protocol)

### Configuration Files

MCP servers are configured by placing JSON files in `<config-root>/mcps/`. Each file should contain a top-level `mcpServers` object. The CLI discovers and merges all JSON files in this directory.

**Example file** (`mcps/servers.json`):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/allowed/files"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

### Environment Variables

MCP configurations can reference environment variables using `${VAR}` syntax. Variables are loaded from `<config-root>/mcps/.env`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### Validation

The CLI validates MCP configurations through a multi-phase pipeline:

1. **Discovery** - Find all JSON files in `mcps/`
2. **Environment Loading** - Load `.env` from `mcps/`
3. **File Processing** - Parse and interpolate variables
4. **Conflict Detection** - Detect duplicate server names
5. **Report** - Generate validation summary

---

## Apply Platform Integration

### Overview

Sync `.agent-ctrl` artifacts into native platform configurations.

### Supported Platforms

| Platform    | Command                        |
| ----------- | ------------------------------ |
| OpenCode    | `agent-ctrl apply opencode`    |
| Claude Code | `agent-ctrl apply claude`      |
| Gemini CLI  | `agent-ctrl apply gemini`      |
| Qwen Code   | `agent-ctrl apply qwen`        |
| Kilo        | `agent-ctrl apply kilo`        |
| Antigravity | `agent-ctrl apply antigravity` |
| Codex CLI   | `agent-ctrl apply codex`       |
| Cursor      | `agent-ctrl apply cursor`      |
| Windsurf    | `agent-ctrl apply windsurf`    |
| Forge Code  | `agent-ctrl apply forgecode`   |

### Usage

```bash
# Apply to a platform (global/user scope by default)
agent-ctrl apply cursor

# Apply to project-based configuration
agent-ctrl apply qwen --project

# Dry run to preview changes
agent-ctrl apply cursor --dry-run

# Force override of conflicting managed content
agent-ctrl apply cursor --override

# Use custom platform configuration root
agent-ctrl apply opencode --path /custom/opencode
```

---
