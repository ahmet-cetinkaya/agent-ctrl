# Kilo Platform Configuration

## Technical Overview

Kilo is an open-source AI coding agent developed by Kilo-Org, available as a standalone CLI (`kilo run`, `kilo serve`) and a VS Code extension (`kilo-code`). The Kilo configuration architecture leverages JSONC files for strict functional settings (`kilo.jsonc`) alongside an auto-migrating, Markdown-based agent system for custom instructions and personas.

Configuration precedence evaluates from the most specific setting to the broadest global setting:

1. **Agent Prompts:** Per-agent inline instructions defined within `kilo.jsonc` (Highest priority).
2. **Project Instructions (Config):** Specific files mapped via the `instructions` array in the project's `kilo.jsonc`.
3. **Project Instructions (Auto-discovered):** `AGENTS.md` (or `CLAUDE.md`, `CONTEXT.md`) at the project root.
4. **Global Instructions (Config):** Instructions mapped via the `instructions` array in the global `kilo.jsonc`.
5. **Global Instructions (Auto-discovered):** `~/.config/kilo/AGENTS.md`.
6. **Dynamic Subdirectory Instructions:** Discovered context injected conditionally when the agent accesses files inside a subdirectory containing an `AGENTS.md`.

_Note: The Kilo VS Code extension bundles its own Kilo CLI runtime. Configuration written to standard `.kilo/` paths applies universally to both the extension and the standalone CLI._

---

## Global Configuration

Global configuration enforces user-level IDE settings, LLM provider routing, auto-approval thresholds, and baseline global behavioral instructions that affect every project opened in Kilo.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory**
The primary user-level configuration is stored in the standard `.config` directory.

```bash
mkdir -p ~/.config/kilo
```

_(On Windows, this corresponds to `C:\Users\<User>\.config\kilo\`)_

**2. Configure Global Settings (`kilo.jsonc`)**
Global settings can be managed via the VS Code Extension UI (Settings → Global Config) or by manually creating the configuration file.

```bash
touch ~/.config/kilo/kilo.jsonc
```

_Example `kilo.jsonc`:_

```jsonc
{
  "instructions": ["~/.config/kilo/global-rules.md"],
  "experimental": {
    // Advanced options not exposed in UI
  },
}
```

**3. Define Global Agent Rules (`AGENTS.md`)**
To instruct Kilo with coding standards applied universally, create a global `AGENTS.md`.

```bash
touch ~/.config/kilo/AGENTS.md
```

_Note: Kilo parses this file automatically across all projects. You do not need to register it in `kilo.jsonc` unless you use a custom filename._

**4. Define Custom Global Agents**
In Kilo, custom modes are implemented as "Agents." You can define new personas globally using Markdown files with YAML frontmatter.

```bash
mkdir -p ~/.config/kilo/agents
touch ~/.config/kilo/agents/reviewer.md
```

_Example `reviewer.md` frontmatter:_

```yaml
---
description: Read-only code reviewer agent
mode: primary
permission:
  allow: ["read", "glob", "grep"]
  deny: ["edit", "bash"]
---
You are a senior auditor. Review code for security without modifying it.
```

---

## Project-Specific Configuration

Project-specific configuration manages tool permissions, custom subagents, and domain-specific rules. Project configurations execute dynamically; when the agent accesses a specific folder, it ingests the `AGENTS.md` for that folder.

### Step-by-Step Project Setup

**1. Create the Project Directory**
Navigate to the root of your repository and create the `.kilo` directory.

```bash
cd /path/to/your/project
mkdir -p .kilo
```

**2. Configure Project Settings (`kilo.jsonc`)**
Create a project-level `kilo.jsonc` file either at the project root or inside `.kilo/` (the latter is preferred for a cleaner repository).

```bash
touch .kilo/kilo.jsonc
```

_Example `.kilo/kilo.jsonc`:_

```jsonc
{
  "agent": {
    "coder": {
      "prompt": "You are working in a strictly-typed Rust monorepo.",
    },
  },
  "instructions": [".kilo/rules/rust-guidelines.md"],
}
```

**3. Provide Core Project Context (`AGENTS.md`)**
Create the primary `AGENTS.md` file at the root of the project. Kilo automatically searches for this file upon startup.

```bash
touch AGENTS.md
```

_(Kilo also supports auto-discovering `CLAUDE.md` and `CONTEXT.md` for ecosystem compatibility)._

**4. Inject Dynamic Subdirectory Context**
For monorepos or segmented codebases, place `AGENTS.md` files inside specific directories. When the Kilo agent executes a `read` tool inside that directory, it automatically discovers the file and injects its contents into the context window as `<rules>` tags.

```bash
mkdir -p packages/frontend
touch packages/frontend/AGENTS.md
```

**5. Define Project-Specific Custom Agents**
If your repository requires specialized task automation (e.g., a custom deployment subagent), define it in the local agents directory.

```bash
mkdir -p .kilo/agents
touch .kilo/agents/deployer.md
```

---

## Source Documentation References

- [Kilo Custom Instructions](https://kilo.ai/docs/customize/custom-instructions)
- [Kilo AGENTS.md Standard](https://kilocode.ai/docs/customize/agents-md)
- [Kilo Custom Modes & Agents](https://kilo.ai/docs/customize/custom-modes)
- [Kilo Settings & Configuration](https://kilo.ai/docs/getting-started/settings)
- [Kilo VS Code Extension Features](https://kilo.ai/docs/code-with-ai/platforms/vscode)
