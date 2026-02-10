# agent-ctrl - Documentation Index

> Version: 1.7.0 (Draft) | Status: Planning Phase

## Quick Links

| Document                               | Description                                                   |
| -------------------------------------- | ------------------------------------------------------------- |
| **[README.md](../README.md)**          | Project overview and quick start                              |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture, directory structure, and design patterns |
| **[COMMANDS.md](COMMANDS.md)**         | Complete CLI command reference                                |
| **[INTEGRATIONS.md](INTEGRATIONS.md)** | SkillsMP and Git template integration                         |
| **[DEVELOPMENT.md](DEVELOPMENT.md)**   | Development setup and contribution guidelines                 |
| **[PRD.md](PRD.md)**                   | Detailed Product Requirements Document                        |

## Project Overview

**agent-ctrl** is a centralized CLI tool for managing AI agent configurations using a **standard directory-based configuration pattern**. It empowers developers to define agent behavior through rules, skills, agents, and MCP servers in a structured, shareable way.

### Key Characteristics

- **Stack:** Bun | TypeScript | Commander.js
- **License:** GPL-3.0
- **Status:** Draft / Early Development

---

## The Standard Directory Pattern

```
.
├── rules/              # Modular Rules (Markdown)
│   ├── coding-style.md
│   └── security.md
├── skills/             # Skills (SKILL.md Standard)
│   ├── git-workflow/
│   │   └── SKILL.md
│   └── web-search.md
├── commands/           # Grouped Commands (Markdown/Scripts)
│   ├── dev/
│   │   └── fix-lint.md
│   └── explain.md
├── agents/             # Agent Personas
│   └── architect.md
└── mcp.json            # MCP Server Configuration
```

---

## Roadmap

### Phase 1: Foundation (v0.1)

- [ ] Basic CLI structure (Bun + Commander)
- [ ] Directory scanner (`rules/`, `skills/`, `agents/`)
- [ ] `apply claude` adapter (Local file mapping)

### Phase 2: Marketplace & Formatting (v0.5)

- [ ] `skill add` command with SkillsMP integration
- [ ] `init` command with GitHub Template support (`giget`)
- [ ] `mcp.json` schema validation

### Phase 3: Advanced Workflows (v1.0)

- [ ] Recursive `commands/` directory support
- [ ] Variable substitution in templates
- [ ] `apply` adapters for Gemini and Cursor
