# Claude Code Platform Configuration

## Technical Overview

Claude Code employs a hierarchical, directory-based configuration model using JSON (`settings.json`) and Markdown (`CLAUDE.md`, `SKILL.md`) formats. This design supports highly granular control across organizational (managed), user (global), shared project, and local (untracked) scopes. This layering ensures that team conventions can be committed to source control while developers retain the freedom to customize their local environment without causing conflicts.

In the event of conflicting configurations, Claude Code evaluates scopes using a strict precedence order (listed from highest priority to lowest):

1.  **Managed Settings:** Organization-enforced policies (cannot be overridden).
2.  **Command-Line Arguments:** Temporary overrides for the current session.
3.  **Local Project Settings:** Untracked developer preferences (`.claude/settings.local.json`).
4.  **Shared Project Settings:** Tracked team conventions (`.claude/settings.json`).
5.  **User Settings (Global):** Tracked global user preferences (`~/.claude/settings.json`).

### Configuration Artifact Locations

Claude Code divides configuration into distinct feature domains:

- **Settings:** Dictate runtime behaviors, environment variables, and tool overrides.
- **CLAUDE.md:** Provides persistent LLM context, coding conventions, and architectural rules.
- **MCP Servers:** Configurations for the Model Context Protocol (injected via `~/.claude.json` globally, or `.mcp.json` per project).
- **Subagents & Skills:** Custom tools and specialized agent personas.

---

## Global Configuration

Global configuration establishes baseline preferences, paths, and behaviors that apply to every Claude Code session across all projects on your machine.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory**
The primary user-level configuration directory is located in your home folder.

```bash
mkdir -p ~/.claude
```

**2. Configure Global Settings (`settings.json`)**
Create or edit `~/.claude/settings.json` to define global environmental variables, preferred update channels, or default execution modes.

```bash
touch ~/.claude/settings.json
```

_Example `~/.claude/settings.json`:_

```json
{
  "autoUpdatesChannel": "stable",
  "permissions": {
    "defaultMode": "plan"
  },
  "env": {
    "USE_BUILTIN_RIPGREP": "1"
  }
}
```

_Note: Do not place MCP server configurations or permission trust states in `settings.json`; these belong in `~/.claude.json` which is managed dynamically by the CLI._

**3. Define Global Context (`CLAUDE.md`)**
To instruct Claude with rules or workflows that you want applied _universally_ across all your codebases, create a global `CLAUDE.md`.

```bash
touch ~/.claude/CLAUDE.md
```

Add personal, globally applicable formatting preferences or reminders here. Keep this file concise, as it is injected into the context of every single session.

**4. Add Global Subagents or Skills**
You can define globally available subagents or skills by placing them in designated subdirectories within `~/.claude/`.

```bash
mkdir -p ~/.claude/agents
mkdir -p ~/.claude/skills
```

---

## Project-Specific Configuration

Project-specific configuration ensures that Claude Code adheres to the repository's unique architectural standards, test commands, and MCP requirements. Project configs override global user configs.

### Step-by-Step Project Setup

**1. Generate the Project Context (`CLAUDE.md`)**
The easiest way to initialize a project is to allow Claude Code to scan the repository and scaffold the `CLAUDE.md` file automatically.
Navigate to your project root and run:

```bash
claude
/init
```

This command analyzes your codebase and generates a `CLAUDE.md` containing discovered build commands, test instructions, and architectural conventions. Commit this file to version control to share it with your team.
_Alternative Path:_ The file can also be safely housed inside the directory as `.claude/CLAUDE.md`.

**2. Configure Shared Project Settings (`settings.json`)**
Create a `.claude` directory and add a `settings.json` file for configuration that should be enforced for the entire team.

```bash
mkdir -p .claude
touch .claude/settings.json
```

_Example `.claude/settings.json`:_

```json
{
  "permissions": {
    "defaultMode": "plan"
  }
}
```

**3. Configure Local Developer Overrides (`settings.local.json`)**
For project settings that you want to apply locally _without_ pushing them to version control, use a `.local.json` file. Claude Code automatically configures git to ignore this file upon creation.

```bash
touch .claude/settings.local.json
```

_Note: This file takes precedence over `.claude/settings.json`._

**4. Configure Project MCP Servers (`.mcp.json`)**
To attach specific MCP servers strictly to the current project, define them in `.mcp.json` at the root of the repository.

```bash
touch .mcp.json
```

_Example `.mcp.json`:_

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

---

---

## agent-ctrl Integration

`agent-ctrl` can automatically apply rules, skills, commands, and MCP servers to Claude Code via the `apply claude` command. This bridges the standardized `.agent-ctrl/` directory structure with Claude Code's native configuration locations.

### How agent-ctrl Applies Artifacts

When you run `agent-ctrl apply claude`, the following transformations occur:

| Artifact Type   | Source (`.agent-ctrl/`)  | Target (`~/.claude/` or `.claude/`) | Transformation                         |
| --------------- | ------------------------ | ----------------------------------- | -------------------------------------- |
| **Rules**       | `rules/*.md`             | `CLAUDE.md` (managed section)       | Injected between HTML comment markers  |
| **Skills**      | `skills/<name>/SKILL.md` | `skills/<name>/`                    | Full directory copy (filesystem-based) |
| **Commands**    | `commands/*.md`          | `commands/<name>/`                  | Rendered as markdown files             |
| **MCP Servers** | `mcps/*.json`            | `.claude.json`                      | Merged into `mcpServers` object        |
| **Agents**      | `agents/*.md`            | `agents/<name>/`                    | Converted with YAML frontmatter        |

### Shared Architecture

**Important:** Claude Code CLI and Desktop App share the same `~/.claude/` configuration directory. When agent-ctrl applies artifacts, they become available to both surfaces.

- Skills placed in `~/.claude/skills/` are loadable via `/skill-name` in CLI and the **Code tab** of the Desktop App
- Rules injected into `~/.claude/CLAUDE.md` apply to all sessions
- MCP servers configured in `~/.claude.json` are accessible to both CLI and Desktop

### Desktop App Limitations

The Claude Desktop App (Chat/Cowork/Code) has a known issue that affects how filesystem skills are displayed:

| Feature               | Code Tab | Chat/Cowork | Customize > Skills Panel           |
| --------------------- | -------- | ----------- | ---------------------------------- |
| `/` slash commands    | ✅ Works | ❌ N/A      | ❌ Does not list filesystem skills |
| Auto-invocation       | ✅ Works | ❌ N/A      | ❌ Does not list filesystem skills |
| Type `/name` manually | ✅ Works | ❌ N/A      | ❌ Does not list filesystem skills |

**Root cause (GitHub issue #31597):** The Customize > Skills panel uses a separate code path that only queries plugin skills and built-in skills — it skips filesystem sources (`~/.claude/skills/` and `.claude/skills/`). Skills are loaded into the runtime and work correctly in the Code tab, but are invisible in the panel.

**Note:** Skills loaded via `~/.claude/skills/` are only available in the **Code tab** of the Desktop App. The Chat and Cowork tabs do not load filesystem-based skills. Skills in those tabs require installation through the Customize > Skills UI (which uploads them to the cloud).

### Output Locations

| Scope   | Config Path          | Description                                       |
| ------- | -------------------- | ------------------------------------------------- |
| User    | `~/.claude/`         | Global configuration (shared by all projects)     |
| Project | `<project>/.claude/` | Project-specific configuration (overrides global) |

### Managed Sections in CLAUDE.md

Rules injected by agent-ctrl are wrapped in HTML comment markers:

```markdown
<!-- agent-ctrl:start -->

[Injected rules content here]

<!-- agent-ctrl:end -->
```

This allows agent-ctrl to update the managed section without affecting manually added content outside the markers.

### MCP Server Configuration

MCP servers are configured in `~/.claude.json` (user scope) or `.claude/.claude.json` (project scope):

```json
{
  "mcpServers": {
    "exa": {
      "transport": {
        "type": "http",
        "url": "https://mcp.exa.ai/mcp"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

**Note:** The PRD previously referenced `~/.claude/config.json` which does not exist. The correct path is `~/.claude.json`.

### Example Workflow

```bash
# 1. Initialize agent-ctrl in your project
agent-ctrl init

# 2. Add skills from SkillsMP
agent-ctrl skill add skillsmp:web-search

# 3. Configure MCP servers
agent-ctrl mcp setup

# 4. Apply to Claude Code
agent-ctrl apply claude

# Artifacts are now available in:
# - ~/.claude/skills/web-search/
# - ~/.claude/CLAUDE.md (rules)
# - ~/.claude.json (MCP servers)
```

> **⚠️ Important:** After running `agent-ctrl apply claude`, you must **restart Claude Code Desktop App** for new skills to be discovered. The file watcher does not detect new skill directories created mid-session — it only watches for modifications to existing skills. This is a known limitation of Claude Code's hot-reload mechanism.

### Known Limitations

1. **Customize > Skills panel:** The Desktop App's skills panel only shows plugin and built-in skills — filesystem skills from `~/.claude/skills/` are not listed there (GitHub issue #31597). They **do work** in the Code tab via `/` slash commands.

2. **Chat/Cowork tabs:** Filesystem skills (`~/.claude/skills/`) are only available in the Code tab. They aren't loaded in Chat or Cowork tabs.

3. **New directories require restart:** If `~/.claude/skills/` didn't exist before starting the Desktop App, newly added skills won't be discovered until restart.

4. **Workaround:** To add skills to Chat/Cowork tabs, upload them through **Customize > Skills** in the Desktop App UI.

---

## Source Documentation References

- [Claude Code Settings Overview](https://docs.anthropic.com/en/docs/claude-code/settings)
- [How Claude Remembers Your Project (CLAUDE.md)](https://docs.anthropic.com/en/docs/claude-code/memory)
- [Extend Claude Code (Features Overview)](https://docs.anthropic.com/en/docs/claude-code/features-overview)
- [Claude Code Permissions & Modes](https://docs.anthropic.com/en/docs/claude-code/permission-modes)
- [Advanced Setup & Customization](https://docs.anthropic.com/en/docs/claude-code/setup)
