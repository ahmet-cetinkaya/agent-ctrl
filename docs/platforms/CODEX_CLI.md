# Codex CLI Platform Configuration

## Technical Overview

The Codex CLI, developed by OpenAI, is a lightweight coding agent designed to run natively in your terminal. Its configuration architecture leverages a layered approach utilizing TOML (`config.toml`) for system and API settings, alongside Markdown (`AGENTS.md`) files for contextual guidance and agent instructions.

Codex strictly separates functional configuration (API keys, models, MCP servers, trust bounds, and feature toggles) from behavioral context (coding rules, architectural guidelines, and developer instructions). Functional configuration is managed centrally, while behavioral instructions utilize a hierarchical discovery process that evaluates scopes from the global level down to the immediate working directory.

Configuration precedence evaluates from the highest specificity to the lowest:

1.  **Command-Line Arguments & Environment Variables:** Highest priority; overrides config files for the active session (e.g., `--model`, `$OLLAMA_API_KEY`).
2.  **Working Directory Context:** `AGENTS.md` located in the current sub-folder.
3.  **Project Root Context:** `AGENTS.md` located at the root of the Git repository.
4.  **User / Global Context:** Global guidance loaded from `~/.codex/AGENTS.override.md` (or `AGENTS.md`).
5.  **Global Configuration File:** Functional settings and profiles loaded from `~/.codex/config.toml`.

_Note: Codex merges `AGENTS.md` files top-down. The global file is read first, followed by the repository root, and finally the current working directory, up to a default maximum limit of 32 KiB._

---

## Global Configuration

Global configuration establishes your overarching environment, default AI models, custom AI providers (e.g., Ollama, Mistral), and global behavioral instructions that apply regardless of the active project.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory**
By default, the Codex CLI utilizes `~/.codex/` (which can be overridden via the `CODEX_HOME` environment variable).

```bash
mkdir -p ~/.codex
```

**2. Configure Global Settings (`config.toml`)**
Create or edit the main configuration file to set up models, API keys, Model Context Protocol (MCP) servers, and feature flags.

```bash
touch ~/.codex/config.toml
```

_Example `~/.codex/config.toml`:_

```toml
# Set the default model and behavior mode
model = "o4-mini"
mode = "ask-user"

# Enable experimental features
[features]
enable_desktop_app = true

# Define an MCP Server
[mcp_servers.github]
command = "npx"
args = ["-y", "@anthropic/mcp-server-github"]
```

_(Environment variables for API keys can be passed naturally through your shell or referenced in custom provider blocks)._

**3. Define Global Agent Guidelines (`AGENTS.md`)**
To enforce persistent, global instructions (e.g., personal coding standards), create a global markdown file.

```bash
touch ~/.codex/AGENTS.md
```

_Note: If you need to override standard global guidance temporarily, you can create `~/.codex/AGENTS.override.md`, which Codex will prioritize over the standard global file._

---

## Project-Specific Configuration

Unlike other platforms that allow arbitrary executable or functional configurations (like models or MCP servers) to be defined inside the project directory, **Codex enforces strict security boundaries**. For security reasons, Codex does _not_ load `config.toml` or approval policies from the project directory.

Project-level configuration in Codex is therefore strictly limited to **Contextual Guidance** (`AGENTS.md`) and **Trust Configuration** (defined globally).

### Step-by-Step Project Setup

**1. Configure Project Trust (in Global Config)**
Because Codex executes code on your machine, project-specific security (trust) is managed centrally in your global `config.toml` rather than locally in the project.

Edit `~/.codex/config.toml` and add your project path:

```toml
[projects]
[projects."/absolute/path/to/your/project"]
trust_level = "trusted"
```

**2. Provide Project-Level Context (`AGENTS.md`)**
Navigate to the root of your repository and create an `AGENTS.md` file. This file contains project-specific guidelines, build commands, and domain knowledge.

```bash
cd /path/to/your/project
touch AGENTS.md
```

_Example `AGENTS.md`:_

```markdown
# Project Architecture

- This is a standard Next.js application using the App Router.
- Always run `npm run lint` before suggesting final changes.
- Do not modify files in the `src/generated` directory.
```

**3. Provide Sub-Directory Context (Optional)**
If your project is a monorepo or has highly specialized subdirectories, you can place additional `AGENTS.md` files inside those specific folders. Codex will merge the root `AGENTS.md` with the sub-folder `AGENTS.md` when executing commands from that directory.

```bash
mkdir -p packages/backend
touch packages/backend/AGENTS.md
```

---

## Source Documentation References

- [Codex CLI GitHub Repository](https://github.com/openai/codex/blob/9a8730f3/codex-cli/README.md)
- [Codex Configuration Documentation](https://github.com/byebye-code/codex/blob/main/docs/config.md)
- [Codex Example config.toml](https://github.com/openai/codex/blob/rust-v0.63.0/docs/example-config.md)
- [Codex CLI Best Practices](https://github.com/shanraisshan/codex-cli-best-practice)
