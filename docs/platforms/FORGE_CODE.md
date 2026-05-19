# Forge Code Platform Configuration

## Technical Overview

Forge Code (also referenced as `forgecode`) is a comprehensive AI-enhanced terminal development environment. It integrates tightly into the command line, enabling developers to interact with multiple models (Claude, GPT, Gemini, Deepseek) through a unified workflow.

Configuration in Forge Code balances functional YAML/TOML settings (`forge.yaml`, `.forge.toml`) with Markdown-based contextual instructions (`AGENTS.md`). The platform allows for granular customization of agent personas, custom commands, and MCP servers across both global and project-specific boundaries.

The configuration precedence dictates that project-local settings override global user settings. The loading hierarchy is structured as follows:

1. **Command-Line Arguments / Session Aliases:** e.g., `:provider`, `:config-reasoning` (Highest priority, temporary).
2. **Project Configuration (`forge.yaml` & `.forge/`):** Rules, custom agents, and commands specific to the repository.
3. **Project Context (`AGENTS.md`):** Auto-loaded conversational instructions at the project root.
4. **Global Context (`~/forge/AGENTS.md`):** Auto-loaded global conversational instructions.
5. **Global Configuration (`~/forge/.forge.toml` & `~/forge/`):** Persistent user settings, agents, and custom commands.

---

## Global Configuration

Global configuration in Forge Code is stored centrally in the `~/forge/` directory. It defines the default models, provider credentials, global context, and custom agents that are universally available across all terminal sessions.

### Step-by-Step Global Setup

**1. Authenticate Providers**
The recommended way to set up AI providers globally is via the interactive CLI command, which securely stores credentials in the global configuration (replacing deprecated `.env` variable setups).

```bash
forge provider login
```

**2. Configure Persistent Global Settings (`.forge.toml`)**
Forge CLI commands can modify global settings automatically, saving them to `~/forge/.forge.toml`. However, you can edit this file directly to set overarching preferences.

```bash
mkdir -p ~/forge
touch ~/forge/.forge.toml
```

**3. Define Global Agent Context (`AGENTS.md`)**
To instruct all Forge agents with global persistent rules (such as preferred communication styles or generic commit message conventions), create a global `AGENTS.md` file. Forge reads this automatically at the start of every conversation.

```bash
touch ~/forge/AGENTS.md
```

**4. Create Global Custom Agents & Commands**
You can define globally available custom agents and shortcut commands (invoked via `:commandname`) using YAML files.

```bash
mkdir -p ~/forge/agents ~/forge/commands
touch ~/forge/agents/reviewer.md
touch ~/forge/commands/refactor.yaml
```

**5. Configure Global MCP Servers**
Global Model Context Protocol servers are configured in a dedicated JSON file within the global directory.

```bash
touch ~/forge/.mcp.json
```

---

## Project-Specific Configuration

Project-specific configuration tailors Forge's behavior to the immediate codebase. Using `forge.yaml`, developers can define rigid custom rules, control directory traversal depth, and override models.

### Step-by-Step Project Setup

**1. Configure Project Settings & Rules (`forge.yaml`)**
Create a `forge.yaml` file in the root of your project. This is the primary configuration file for local Forge execution, allowing you to define inline `custom_rules`, `commands`, and parameters like `temperature` and `max_walker_depth`.

```bash
cd /path/to/your/project
touch forge.yaml
```

_Example `forge.yaml`:_

```yaml
model: "claude-3.7-sonnet"
temperature: 0.3
max_walker_depth: 3

custom_rules: |
  1. Always add comprehensive error handling to any code you write.
  2. Include unit tests for all new functions.
  3. Follow our team's naming convention: camelCase for variables, PascalCase for classes.

commands:
  - name: "refactor"
    description: "Refactor selected code"
    prompt: "Please refactor this code to improve readability and performance"
```

**2. Define Project Context (`AGENTS.md`)**
Create an `AGENTS.md` file in the project root to give agents persistent instructions regarding coding conventions, architecture, and anti-patterns specific to this repository.

```bash
touch AGENTS.md
```

**3. Create Project-Local Custom Agents**
If your repository requires specialized agents (e.g., a specific agent designed to interact with your local database schema), define them in the `.forge/agents/` directory. These files use YAML frontmatter combined with a Markdown system prompt.

```bash
mkdir -p .forge/agents
touch .forge/agents/db-expert.md
```

_(Project-local agents will override global agents with the same name)._

**4. Configure Project MCP Servers**
To provide Forge with project-specific MCP servers, define an `.mcp.json` file in the project directory. This takes precedence over the global `~/forge/.mcp.json`.

```bash
touch .mcp.json
```

---

## Source Documentation References

- [Forge Code GitHub Repository](https://github.com/tailcallhq/forgecode)
- [Forge Code AI Agent Overview](https://github.com/lineCode/forge-code-agent)
- [Forge Code Advanced Configuration Guide](https://github.com/AsaadAbbas/forgecode)
