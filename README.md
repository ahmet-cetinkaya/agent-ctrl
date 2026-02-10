<!-- ![ag-ctrl icon](https://raw.githubusercontent.com/ahmet-cetinkaya/agent-ctrl/refs/heads/main/docs/icon/icon-100.webp) -->

# `agent-ctrl` [![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?&logo=buy-me-a-coffee&logoColor=black)](https://ahmetcetinkaya.me/donate) [![GitHub license](https://img.shields.io/github/license/ahmet-cetinkaya/agent-ctrl)](LICENSE) [![GitHub stars](https://img.shields.io/github/stars/ahmet-cetinkaya/agent-ctrl?style=social)](https://github.com/ahmet-cetinkaya/agent-ctrl/stargazers) [![GitHub forks](https://img.shields.io/github/forks/ahmet-cetinkaya/agent-ctrl?style=social)](https://github.com/ahmet-cetinkaya/agent-ctrl/network/members)

A centralized CLI tool for managing AI agent configurations using a **standard directory-based configuration pattern**. Define agent behavior through rules, skills, agents, and MCP servers in a structured, shareable way.

**Stack:** [![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**Status:** 🚧 Draft / Early Development

## 🚀 Quick Start

```bash
# Initialize a new project
agent-ctrl init

# Install a skill from SkillsMP
agent-ctrl skill add skillsmp:code-review

# Apply configuration to Claude Code
agent-ctrl apply claude
```

## 📚 Documentation

| Document                                 | Description                                                   |
| ---------------------------------------- | ------------------------------------------------------------- |
| **[ARCHITECTURE](docs/ARCHITECTURE.md)** | System architecture, directory structure, and adapter pattern |
| **[COMMANDS](docs/COMMANDS.md)**         | Complete CLI command reference                                |
| **[INTEGRATIONS](docs/INTEGRATIONS.md)** | SkillsMP and Git template integration                         |
| **[DEVELOPMENT](docs/DEVELOPMENT.md)**   | Development setup and contribution guidelines                 |
| **[PRD](docs/PRD.md)**                   | Detailed Product Requirements Document                        |

## 📂 The Standard Directory Pattern

```
.
├── rules/              # Behavioral Rules (Markdown)
├── skills/             # Skills (SKILL.md Standard)
├── commands/           # Command prompts (Markdown/Scripts)
├── agents/             # Agent Personas
└── mcp.json            # MCP Server Configuration
```

> See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for complete details on the directory structure and adapter pattern.

## ✨ Key Features

- **Convention over Configuration** — The directory structure IS the configuration
- **Multi-Platform Support** — Apply same config to Claude, Gemini, Cursor via adapters
- **SkillsMP Integration** — Discover and install skills from the community marketplace
- **Template Scaffolding** — Initialize projects from GitHub/GitLab/Bitbucket templates

## 🤝 Contributing

Please see [DEVELOPMENT.md](docs/DEVELOPMENT.md) for contribution guidelines.

## 📄 License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
