# Integrations

## SkillsMP Integration

### Overview

SkillsMP is a marketplace for discovering and sharing AI agent skills. agent-ctrl integrates with SkillsMP to enable seamless skill installation and updates.

### Discovery

Search for skills by keyword or category:

```bash
# Search for testing skills
agent-ctrl skill search "testing"

# Search with filters
agent-ctrl skill search "web" --category development
```

### Installation

Install skills directly from SkillsMP:

```bash
# Install by ID
agent-ctrl skill add skillsmp:code-review

# Install specific version
agent-ctrl skill add skillsmp:git-workflow@1.2.0
```

**Behavior:**

1. Fetches `SKILL.md` and related assets
2. Creates `skills/<id>/` directory
3. Tracks source for updates
4. Validates SKILL.md standard

### Updates

Keep skills up-to-date:

```bash
# Update specific skill
agent-ctrl skill update git-workflow

# Update all installed skills
agent-ctrl skill update --all

# Check for updates
agent-ctrl skill check-updates
```

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

## Configuration

Edit `config/{{ ENV }}.json` with your settings.

```

The CLI will prompt for:
- `PROJECT_NAME`: Display name
- `ENV`: Environment (development, production, etc.)

### Custom Templates

Create your own templates by following the standard directory structure:

```

my-agent-template/
├── rules/
│ └── coding-style.md
├── skills/
│ └── SKILL.md
├── agents/
│ └── senior-dev.md
└── README.md

````

Push to GitHub and share:

```bash
agent-ctrl init yourusername/my-agent-template
````

---

## MCP (Model Context Protocol)

### Configuration File

`mcp.json` defines MCP server connections:

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@anthropic/mcp-server-filesystem",
        "/path/to/allowed/files"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

### Validation

The CLI validates `mcp.json` against a Zod schema:

```bash
agent-ctrl mcp validate
```

### Schema

```typescript
const McpConfigSchema = z.object({
  servers: z.record(
    z.object({
      command: z.string(),
      args: z.array(z.string()),
      env: z.record(z.string()).optional(),
    }),
  ),
});
```

---

## Future Integrations

### Planned

- [ ] **npm Registry:** Skill packages as npm modules
- [ ] **Custom Registries:** Private skill marketplaces
- [ ] **GitHub Actions:** CI/CD integration for artifact validation
- [ ] **Webhook Support:** Automatic updates from remote templates

### Community

Want to add integration support? See [DEVELOPMENT.md](DEVELOPMENT.md) for contribution guidelines.
