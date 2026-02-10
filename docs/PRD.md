# Product Requirements Document (PRD)

## 1. Executive Summary

|                  |                               |
| :--------------- | :---------------------------- |
| **Project Name** | `agent-ctrl`                  |
| **Version**      | 1.7.0                         |
| **Status**       | Draft                         |
| **Stack**        | Bun, TypeScript, Commander.js |

`agent-ctrl` is a centralized Command-Line Interface (CLI) tool that empowers developers to manage AI agent configurations using a **standard directory-based configuration pattern**. It leverages a project-local directory structure to define agent behavior and provides granular commands to manage rules, skills, agents, and MCP servers. It natively supports initializing projects from **GitHub templates** and installing skills from **SkillsMP**.

## 2. Problem Statement

Developers working with AI agents face several challenges:

- **Fragmentation:** Agent rules and skills are often scattered across different config files or project documentation.
- **Tedious Setup:** Initializing a new project with the correct agent persona and toolset is a manual, error-prone process.
- **Lack of Standards:** There is no unified way to share agent capabilities (skills) or behavioral guidelines (rules) across teams or the community.

## 3. Target Audience

- **AI Engineers:** Developers building and fine-tuning agent behaviors who need a structured way to manage prompts and tools.
- **DevOps Teams:** Professionals integrating AI agents into CI/CD pipelines who require consistent configuration across environments.
- **Team Leads:** Managers looking to standardize coding guidelines and tool sets across a development team.
- **Open Source Maintainers:** Creators sharing agent templates and skills with the community.

## 4. Success Metrics

- **Adoption:** Number of GitHub stars and active installs via npm/bun.
- **Efficiency:** Reduction in time to set up a new agent project (Target: < 1 minute from 0 to Hello World).
- **Reliability:** 99% success rate for `agent-ctrl apply` commands across supported platforms.
- **Ecosystem:** Growth in the number of available SkillsMP skills compatible with `agent-ctrl`.

## 5. Goals & Objectives

- **Standardization:** Establish a convention-over-configuration standard for defining agent behaviors (`rules/`) and capabilities (`skills/`).
- **Rapid Scaffolding:** Enable one-command project initialization using remote GitHub templates.
- **Seamless Management:** Provide specific CLI commands to discover, add, and update artifacts from marketplaces like SkillsMP.
- **Multi-Agent Support:** Allow the same configuration to be "applied" to various backends (Claude, Gemini, Antigravity) via adapters.

## 6. Functional Requirements

### 6.1. Directory Structure (The Standard)

The CLI operates on the following project-local structure:

```text
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

### 6.2. CLI Command Hierarchy

#### Global Workflow

| Command           | Description                                                    | Example                      |
| :---------------- | :------------------------------------------------------------- | :--------------------------- |
| `init [template]` | Scaffold a new project, optionally from a remote Git template. | `agent-ctrl init owner/repo` |
| `apply [target]`  | Deploy local artifacts to a target agent environment.          | `agent-ctrl apply claude`    |
| `build [target]`  | Generate static configuration files without applying.          | `agent-ctrl build cursor`    |

#### Artifact Management

Each artifact type has a dedicated subcommand group support `add`, `ls`, and `rm` operations.

| Scope       | Usage                         | Description                                                        |
| :---------- | :---------------------------- | :----------------------------------------------------------------- |
| **Rule**    | `agent-ctrl rule add <id>`    | Manage behavioral rules in `rules/`.                               |
| **Skill**   | `agent-ctrl skill add <id>`   | Manage skills in `skills/`. Integrates with **SkillsMP**.          |
| **Command** | `agent-ctrl command ls`       | specific commands/prompts in `commands/`. Supports subdirectories. |
| **Agent**   | `agent-ctrl agent add <name>` | Manage agent personas in `agents/`.                                |
| **MCP**     | `agent-ctrl mcp setup`        | Configure MCP servers in `mcp.json`.                               |

### 6.3. Target Platforms & Adapters

The tool uses specialized adapters to translate standard artifacts into agent-specific formats:

| Platform                 | Handling Strategy                                                                | output                      |
| :----------------------- | :------------------------------------------------------------------------------- | :-------------------------- |
| **Claude Code**          | Symmetric mapping of `rules`, `skills`, and `commands`.                          | `~/.claude/config.json`     |
| **Gemini / Antigravity** | Injects rules into System Instructions. Maps `skills/` to Function Declarations. | API Context / System Prompt |
| **Codex**                | Injects `rules/` and `agents/` content into the active context or rules file.    | `.cursorrules`              |
| **Generic (MCP)**        | Generates standardized MCP settings.                                             | `mcp_settings.json`         |

### 6.4. Integrations

#### SkillsMP Integration

- **Discovery:** Users can search for skills via `agent-ctrl skill search <query>`.
- **Installation:** `agent-ctrl skill add skillsmp:<id>` fetches the `SKILL.md` (and related assets) and places them in `skills/<id>/`.
- **Updates:** The CLI tracks the source of installed skills to enable easy updates.

#### Git Template Support

- **Remote Init:** `agent-ctrl init <user>/<repo>` clones a public repository.
- **Engine:** Uses `giget` for efficient fetching (supports GitHub, GitLab, Bitbucket).
- **Post-Processing:**
  - Removes `.git` history.
  - Prompts for variable substitution (e.g., `{{ PROJECT_NAME }}`) found in template files.

## 7. Non-Functional Requirements

- **Performance:** `init` and `apply` operations must complete in < 2 seconds for typical projects.
- **Portability:** The CLI must run on Linux, macOS, and Windows without external dependencies other than a Node.js/Bun runtime.
- **UX:** Provide rich, interactive terminal output (using `ora` spinners and `chalk` colors).

## 8. Technical Architecture

### 8.1. Core Modules

1.  **CLI Entry (`src/index.ts`):** Commander.js setup and command routing.
2.  **Config Loader (`src/config/`):** Reads `mcp.json` and scans the directory structure. Uses **Zod** for schema validation.
3.  **Registry Client (`src/registry/`):** Handles fetching artifacts from SkillsMP and Git templates (via `giget`).
4.  **Adapters (`src/adapters/`):** logic for transforming the standard config into platform-specific outputs.
    - `ClaudeAdapter`
    - `GeminiAdapter`
    - `CursorAdapter`

### 8.2. Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **Validation:** Zod
- **CLI:** Commander.js, Inquirer.js
- **Template Fetching:** giget

## 9. Roadmap

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
