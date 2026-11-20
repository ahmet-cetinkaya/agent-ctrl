# Configuration

## Directory Structure

When you run `agent-ctrl init`, it creates the following structure:

```
~/.agent-ctrl/               # Default config root (overridable via AGENT_CTRL_HOME)
├── .env                     # API keys for remote catalogs (not committed)
├── .env.example             # Template for .env
├── .gitignore               # Git ignore patterns
├── README.md                # Config root documentation
├── agents/                  # Agent persona definitions (.md files)
├── commands/                # Reusable command definitions (.md files, recursive)
├── mcps/                    # MCP server configurations (JSON files)
│   └── .env                 # MCP-specific environment variables
├── rules/                   # Rule files (coding standards, etc.)
├── skills/                  # Installed skills (SKILL.md directories)
├── profiles/                # Configuration profiles (optional)
│   └── default/             # Profile directory with artifact references
└── catalog/                 # Cached catalog state (managed, do not edit)
    └── catalog.json         # Sync cache, discovery scopes, managed integrations
```

## Environment Variables

Create `.agent-ctrl/.env` with your API keys:

```bash
SKILLSMP_API_KEY=your_skillsmp_key
SMITHERY_API_KEY=your_smithery_key
```

### Configuration Root

The config root is resolved in this order:

1. `AGENT_CTRL_HOME` environment variable (highest priority)
2. `~/.agent-ctrl` (default)

### Credential Precedence

1. `--api-key` flag (highest priority, single command only)
2. Environment file (`.agent-ctrl/.env`)
3. System environment variables (lowest priority)

## Artifact Types

### Rules (`rules/`)

Coding standards, guidelines, and rules that agents should follow. Add markdown files directly to this directory.

**Example:**

```markdown
# Coding Style Rules

- Use 2-space indentation
- Use semicolons
- Use double quotes
- Use trailing commas
```

```bash
# List rules
agent-ctrl rule ls
```

**Cursor and Windsurf rule files:** each rule file agent-ctrl writes starts, after any frontmatter, with a line `<!-- agent-ctrl:managed sha256=... -->`. The hash covers the rest of the file. On the next apply, a marked file the profile no longer renders is removed only if the hash still matches. Hand-written files, edited copies and files from older versions are kept. The apply output lists removed files (`Would remove` on a dry run) and kept files. To read the marker, an apply scans all `.md` and `.mdc` files under the rules folder.

### Skills (`skills/`)

Discoverable capabilities. Add markdown files directly to this directory, or install from SkillsMP registry.

**Example:**

```markdown
# Code Review Skill

## Description

Performs thorough code reviews focusing on security, performance, and best practices.

## Capabilities

- Security vulnerability detection
- Performance optimization suggestions
- Code style consistency checks
```

```bash
# Add from SkillsMP
agent-ctrl skill add skillsmp:code-review

# List installed skills
agent-ctrl skill ls

# Update skills
agent-ctrl skill update --all --refresh
```

### Agents (`agents/`)

Agent persona definitions and configurations. Add markdown files directly to this directory.

**Example:**

```markdown
# Senior Developer Agent

You are a senior software developer with expertise in system design and code quality.

## Responsibilities

- Architect scalable solutions
- Review pull requests
- Mentor junior developers
- Ensure code quality standards
```

```bash
# List agents
agent-ctrl agent ls
```

### Commands (`commands/`)

Reusable command definitions for agents. Add markdown files directly to this directory. You can organize commands into subdirectories.

**Example:**

```markdown
# Explain Code Command

Explain what the selected code does in clear, concise language.

## Usage

When user requests explanation of code selection:

1. Read the selected code carefully
2. Identify the purpose and functionality
3. Explain in beginner-friendly terms
4. Note any potential issues or improvements
```

```bash
# List commands
agent-ctrl command ls
```

### MCP Servers (`.agent-ctrl/mcps/`)

MCP server configurations for Model Context Protocol integration. You can add servers from Smithery registry, or create custom JSON configurations.

```bash
# Add from Smithery
agent-ctrl mcp add smithery:github

# List configured MCPs
agent-ctrl mcp ls

# Update MCPs
agent-ctrl mcp update --all --refresh
```

#### Custom JSON Configuration

Add your own MCP server configurations by creating JSON files in `.agent-ctrl/mcps/`. Each file should contain a top-level `mcpServers` object.

**Stdio Transport (default):**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/allowed/files"],
      "env": {
        "API_KEY": "${API_KEY}"
      },
      "cwd": "/custom/working/directory"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

**HTTP Transport:**

```json
{
  "mcpServers": {
    "my-http-server": {
      "type": "http",
      "url": "https://mcp.example.com/server"
    }
  }
}
```

**Secrets in project-scope configs:**

`agent-ctrl` resolves `${VAR}` placeholders from `mcps/.env`. A project-scope MCP config is meant to be committed, so `agent-ctrl` never writes a resolved value there. Where the platform reads environment variables from its config at run time, the placeholder is written as the platform's own reference; export those variables before you start the tool (the apply output lists them). A server with a placeholder in a field the platform cannot resolve is skipped with a warning; apply it with `--user` instead.

| Platform                           | Project MCP file                               | Reference written           | Fields                  |
| ---------------------------------- | ---------------------------------------------- | --------------------------- | ----------------------- |
| Claude Code                        | `.mcp.json`                                    | `${VAR}`                    | command, args, env, url |
| OpenCode, Kilo                     | `opencode.json`, `.kilo/kilo.jsonc`            | `{env:VAR}`                 | command, args, env, url |
| Gemini CLI, Qwen Code              | `.gemini/settings.json`, `.qwen/settings.json` | `${VAR}`                    | env                     |
| Pi (`pi-mcp-adapter`)              | `.mcp.json`                                    | `${VAR}`                    | env, url                |
| Pi forks (builtin MCP), Forge Code | `.<configDir>/mcp.json`, `.mcp.json`           | none: the server is skipped | none                    |

User-scope configs receive the resolved values and are written with mode `0600`.

**Claude Code project scope:**

A project-scope apply for Claude Code merges the MCP servers into `<project>/.mcp.json` under `mcpServers`. Servers you added yourself stay as they are. Commit the file to share the servers with your team; a fresh clone needs no second apply. Claude Code expands `${VAR}` from the environment when it starts, and the apply output lists the variables that are not set in the current shell.

Earlier versions stored these servers in `~/.claude.json` (`projects["<path>"].mcpServers`). A project-scope apply now removes the servers it manages from that entry, so they do not load twice, and reports the move in the apply output. Other servers and keys in `~/.claude.json` stay untouched. Apply at user scope to write servers to `~/.claude.json` for every project.

Claude Code still supports the earlier placement, the local scope in `~/.claude.json` under `projects["<path>"].mcpServers` ([Claude Code MCP scopes](https://code.claude.com/docs/en/mcp#mcp-installation-scopes)). Pass `--claude-mcp-scope local` to `apply` or `profile apply` to keep using it. The values are `project` (the default) and `local`. With `local`, agent-ctrl writes resolved values to `~/.claude.json` as before, does not touch `<project>/.mcp.json`, and does not remove anything from `~/.claude.json`. The flag applies to a project-scope apply only; at user scope it is ignored with a warning.

### Profiles (`profiles/`)

Profiles allow you to define named configurations that bundle specific artifacts for targeted platform application.

**Structure:**

```
profiles/
└── default/              # Profile name (any directory name)
    ├── profile.yaml      # Optional: display metadata (name, description, tags)
    ├── rules/            # Optional: profile-specific rules
    ├── skills/           # Optional: profile-specific skills
    └── ...               # Other artifact subdirectories
```

**Metadata (`profile.yaml`):**

Each profile directory can optionally include a `profile.yaml` with display metadata. The first tag is treated as the profile's **category** — profiles are grouped by category when listed or picked interactively. A profile without `profile.yaml` (or without tags) falls back to the `Uncategorized` group. If a `profile.yaml` exists but cannot be read or fails to parse, `profile list`/`profile apply` still list the profile (using the directory name as a fallback) and print a warning identifying the affected profile.

```yaml
name: Machine Learning
description: "Machine learning / AI — agents and skills for model training, MLOps, and applied ML."
tags:
  - ai
  - training
  - mlops
  - pytorch
```

```bash
# List profiles (grouped by category, with description and tags)
agent-ctrl profile list

# Apply a profile to a platform
agent-ctrl profile apply default --platform opencode
```
