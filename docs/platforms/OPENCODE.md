# OpenCode Platform Configuration

## Technical Overview

OpenCode is an open-source AI coding agent available via a terminal-based interface (TUI), desktop application, or IDE extension. Its configuration architecture follows a flexible, multi-layered inheritance model utilizing JSON (`opencode.json`) and Markdown (`AGENTS.md`) structures. This hierarchical design allows organizations, individual developers, and distinct projects to seamlessly overlay configurations, supporting customized AI models, providers, Language Server Protocols (LSP), Model Context Protocols (MCP), rules, and specialized agents.

Configuration in OpenCode operates on a strict merging principle: files are combined rather than completely replaced. In the event of conflicts, settings from a source with higher precedence override those from a lower precedence source, while preserving all non-conflicting configurations.

### Configuration Precedence Architecture

OpenCode resolves configurations according to the following hierarchy (listed from lowest to highest priority):

1.  **Built-in Defaults:** Hardcoded application defaults.
2.  **Remote Config:** Organizational defaults retrieved from `.well-known/opencode`.
3.  **Global Config:** User-level preferences found at `~/.config/opencode/opencode.json`.
4.  **Custom Config:** Driven by the `OPENCODE_CONFIG` environment variable.
5.  **Project Config:** Specific project settings loaded from `.opencode.json` (or `opencode.json`) in the project root.
6.  **Directory Configs:** Granular configurations for agents, commands, and plugins defined in `.opencode/` or `~/.config/opencode/`.
7.  **Command-line / Inline Config:** Runtime overrides specified via flags or the `OPENCODE_CONFIG_CONTENT` environment variable.
8.  **Managed Settings:** Enterprise administrator overrides (e.g., macOS Mobile Device Management `.mobileconfig` profiles), which are absolute and non-overridable.

---

## Global Configuration

Global configuration establishes baseline user preferences—such as default AI models, custom formatting, and overarching tool permissions—that apply persistently across all OpenCode sessions and projects on your machine.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory and File**
OpenCode primarily looks for your global JSON configuration in the XDG-compliant config path:

- **Linux/macOS:** `~/.config/opencode/opencode.json` (also supports `~/.opencode.json`)
- **Windows:** `%USERPROFILE%\.opencode.json` or `%LOCALAPPDATA%\opencode\.opencode.json`

Create the configuration file:

```bash
mkdir -p ~/.config/opencode
touch ~/.config/opencode/opencode.json
```

**2. Define Global Settings**
Populate the `opencode.json` file. Below is an example establishing the default agent mode and securing command execution permissions:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "default_agent": "plan",
  "permission": {
    "*": "allow",
    "edit": "allow",
    "webfetch": "allow",
    "external_directory": "ask",
    "bash": {
      "*": "allow",
      "rm *": "ask",
      "rmdir *": "ask"
    }
  }
}
```

_Note: Defining explicit allowances (like `"edit": "allow"`) ensures that remote defaults pushing `"ask"` do not override your local workflow._

**3. Define Global Agent Rules**
To configure global behavioral instructions for the LLM that span all projects, create an `AGENTS.md` file in the same global directory:

```bash
touch ~/.config/opencode/AGENTS.md
```

Add personal coding standards, preferences, or rules to this markdown file.

**4. Define Custom Global Modes/Agents**
Global custom agents (modes) can be added as markdown files in the `modes/` subdirectory:

```bash
mkdir -p ~/.config/opencode/modes
touch ~/.config/opencode/modes/refactor.md
```

_Example `refactor.md` frontmatter:_

```yaml
---
name: refactor
model: claude-3.7-sonnet
temperature: 0.2
tools:
  edit: true
  bash: true
  glob: true
---
You are in refactoring mode. Focus on improving code quality without changing functionality.
```

---

## Project-Specific Configuration

Project-level configurations provide context boundary control. They contain project-specific LLM parameters, context paths, MCP servers, and coding rules. They take precedence over both remote and global configurations, ensuring that organizational defaults do not interfere with local repository requirements.

### Step-by-Step Project Setup

**1. Initialize the Project**
Navigate to your project root directory and trigger OpenCode initialization. This command analyzes your project structure and scaffolds an `AGENTS.md` file automatically.

```bash
cd /path/to/your/project
opencode
/init
```

**2. Define Project Rules (`AGENTS.md`)**
The `/init` command creates an `AGENTS.md` file in the root. Edit this file to add project-specific instructions, coding patterns, and structural guidelines. This file should be committed to version control.

**3. Configure Project-Specific Overrides (`opencode.json`)**
Create an `opencode.json` (or `.opencode.json`) in the root of your project to override global AI model selections or tool configurations.

```bash
touch .opencode.json
```

_Example Project `.opencode.json`:_

```json
{
  "agents": {
    "coder": {
      "model": "gpt-4.1",
      "maxTokens": 20000,
      "reasoningEffort": "high"
    }
  }
}
```

This configuration forces the "coder" agent to use a specific model and token limit strictly within this project context.

**4. Define Project-Specific Custom Modes**
Similar to global configuration, you can establish project-only agents by adding markdown files to a local `.opencode/modes/` directory.

```bash
mkdir -p .opencode/modes
touch .opencode/modes/review.md
```

Configurations and instructions contained here will only be active when operating within the current project hierarchy.

---

## Source Documentation References

- [OpenCode Official Configuration Docs](https://opencode.ai/docs/config/)
- [OpenCode Core Concepts - Configuration](https://opencode-ai-opencode.mintlify.app/core-concepts/configuration)
- [OpenCode AGENTS.md Project Guidelines](https://open-code.ai/en/docs/rules)
- [OpenCode Modes Configuration](https://open-code.ai/en/docs/modes)
- [OpenCode School - Configuration Lesson](https://opencode.school/lessons/configuration/)
