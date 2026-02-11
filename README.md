# agent-ctrl

[![Bun](https://img.shields.io/badge/Bun-000000?style=flat&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![GitHub stars](https://img.shields.io/github/stars/ahmet-cetinkaya/agent-ctrl?style=social)](https://github.com/ahmet-cetinkaya/agent-ctrl/stargazers)

A centralized CLI tool for managing AI agent configurations using a **standard directory-based configuration pattern**. Define agent behavior through rules, skills, agents, and MCP servers in a structured, shareable way that works across multiple AI platforms.

**Status:** 🚧 Early Development phase.

---

## 🚀 Quick Start

### Installation

```bash
# Using Bun (Recommended)
bun install -g agent-ctrl

# Using NPM
npm install -g agent-ctrl
```

### Basic Usage

```bash
# 1. Initialize a new project with the standard structure
agent-ctrl init

# 2. Add a skill from SkillsMP marketplace
agent-ctrl skill add skillsmp:code-review

# 3. Apply your configuration to Claude Code
agent-ctrl apply claude
```

---

## 📦 Installation Options

### Global Installation

We recommend installing `agent-ctrl` globally to use it across any project.

```bash
bun add -g agent-ctrl
# OR
npm install -g agent-ctrl
```

### From Source

If you want to contribute or use the latest development version:

```bash
git clone https://github.com/ahmet-cetinkaya/agent-ctrl.git
cd agent-ctrl
bun install
bun run src/presentation/cli/index.ts --help
```

---

## 🛠 Usage & Commands

`agent-ctrl` provides a comprehensive suite of commands to manage your AI agent's artifacts.

### Global Workflow

- `init [template]` - Scaffold a new project. Supports GitHub templates (e.g., `agent-ctrl init owner/repo`).
- `apply <target>` - Deploy local artifacts to a target environment (`claude`, `gemini`, `cursor`, `mcp`).
- `build <target>` - Generate static configuration files without applying them.

### Artifact Management

#### Rules (`rules/`)

Modular behavioral guidelines in Markdown.

- `agent-ctrl rule ls` - List all rules.
- `agent-ctrl rule add <id>` - Add a new rule file.
- `agent-ctrl rule rm <id>` - Remove a rule.

#### Skills (`skills/`)

Capabilities following the `SKILL.md` standard.

- `agent-ctrl skill ls` - List installed skills.
- `agent-ctrl skill add <id>` - Install a skill (supports `skillsmp:<id>`).
- `agent-ctrl skill search <query>` - Search for skills on SkillsMP.
- `agent-ctrl skill rm <id>` - Remove a skill.

#### Commands (`commands/`)

Grouped command prompts or scripts.

- `agent-ctrl command ls` - List available commands.
- `agent-ctrl command add <name>` - Add a new command prompt.

#### Agents (`agents/`)

Agent personas and identity definitions.

- `agent-ctrl agent ls` - List agent personas.
- `agent-ctrl agent add <name>` - Define a new agent persona.

#### MCP Setup (`mcp.json`)

- `agent-ctrl mcp setup` - Interactive MCP server configuration.
- `agent-ctrl mcp ls` - List configured MCP servers.

---

## 📂 Project Structure

`agent-ctrl` enforces a **Convention over Configuration** pattern. The directory structure IS your agent's configuration.

```text
.
├── rules/              # Modular behavioral rules (Markdown)
│   ├── coding-style.md
│   └── security.md
├── skills/             # Capabilities (SKILL.md standard)
│   └── git-workflow/
│       └── SKILL.md
├── commands/           # Command prompts (Markdown/Scripts)
│   ├── dev/
│   │   └── fix-lint.md
│   └── explain.md
├── agents/             # Agent personas
│   └── architect.md
└── mcp.json            # MCP server configuration
```

---

## 🛠 Development

### Prerequisites

- [Bun](https://bun.sh) (latest LTS)
- TypeScript 5.0+

### Setup

```bash
bun install
```

### Common Tasks

- **Run in dev mode:** `bun dev`
- **Build:** `bun run build`
- **Test:** `bun test`
- **Lint:** `bun run lint`
- **Format:** `bun run format`

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.
