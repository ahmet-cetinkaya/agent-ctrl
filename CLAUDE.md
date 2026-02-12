# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`agent-ctrl` is a CLI tool for managing AI agent configurations using a **standard directory-based configuration pattern**. The project establishes conventions for defining agent behaviors (`rules/`), capabilities (`skills/`), and personas (`agents/`) that can be applied to different AI platforms (Claude, Gemini, Cursor) via adapters.

**Status:** Early development phase - source directories exist but implementation is pending.

## Architecture

### The Standard Directory Pattern

The core concept is a project-local directory structure that defines agent behavior:

```
.
├── rules/              # Behavioral rules (Markdown)
├── skills/             # Capabilities (SKILL.md standard)
├── commands/           # Command prompts (Markdown/Scripts)
├── agents/             # Agent personas (Markdown)
└── mcp.json            # MCP server configuration
```

### Source Structure (Clean Architecture)

```
src/
├── core/
│   ├── domain/         # Domain models (Rule, Skill, Agent, McpConfig)
│   └── application/    # Use cases (init, apply, build, artifact management)
├── infrastructure/     # External integrations (SkillsMP, giget, file I/O)
└── presentation/
    └── cli/            # Commander.js interface layer
```

### Adapter Pattern

Each target platform has a specialized adapter that transforms the standard artifacts into platform-specific formats:

| Platform    | Adapter         | Output Location             |
| ----------- | --------------- | --------------------------- |
| Claude Code | `ClaudeAdapter` | `~/.claude/config.json`     |
| Gemini      | `GeminiAdapter` | API Context / System Prompt |
| Cursor      | `CursorAdapter` | `.cursorrules`              |
| Generic MCP | `McpAdapter`    | `mcp_settings.json`         |

### Key Integrations

- **SkillsMP:** Marketplace for discovering and installing skills (`agent-ctrl skill add skillsmp:<id>`)
- **giget:** Template fetching from Git remotes (`agent-ctrl init owner/repo`)
- **Zod:** Schema validation for `mcp.json` and configuration files

## CLI Command Hierarchy

### Global Workflow

- `init [template]` - Scaffold project from Git template
- `apply [target]` - Deploy artifacts to target platform
- `build [target]` - Generate config without applying

### Artifact Management

Each artifact type supports `add`, `ls`, `rm`:

- `agent-ctrl rule <id>` - Manage rules in `rules/`
- `agent-ctrl skill <id>` - Manage skills in `skills/`
- `agent-ctrl command <id>` - Manage commands in `commands/`
- `agent-ctrl agent <name>` - Manage agent personas in `agents/`
- `agent-ctrl mcp setup` - Configure MCP servers

## Development Setup

```bash
# Install dependencies (when package.json is populated)
bun install

# Run the CLI
bun run src/index.ts

# Development build (to be implemented)
bun run dev
```

## Design Principles

1. **Convention over Configuration** - The directory structure IS the configuration
2. **Adapter Pattern** - Same artifacts, multiple target platforms
3. **Modular Rules** - Rules are discrete Markdown files that can be composed
4. **SKILL.md Standard** - Skills follow a standardized format for interoperability

## Important Files

- `docs/PRD.md` - Complete Product Requirements Document
- `docs/INDEX.md` - Project index and quick reference
- `README.md` - Project overview and usage examples

## Active Technologies

- TypeScript via Bun (latest LTS) + Commander.js (CLI framework), filesystem modules (node:fs) (001-cli-foundation)
- Local filesystem (markdown files, JSON configuration) (001-cli-foundation)

## Recent Changes

- 001-cli-foundation: Added TypeScript via Bun (latest LTS) + Commander.js (CLI framework), filesystem modules (node:fs)
