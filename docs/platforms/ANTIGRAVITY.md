# Antigravity Platform Configuration

## Technical Overview

Antigravity is Google's AI-powered IDE (built on VS Code) and corresponding headless CLI (`agcl` or `ag`) featuring deep Gemini integration, multi-provider failover, and a fully agentic cognitive architecture. Configuration in Antigravity leans heavily into "Zero-Config" discovery mechanisms: rather than forcing developers to maintain complex JSON manifests, Antigravity infers context, rules, and tools directly from the presence of Markdown files and Python scripts in standard directories.

Antigravity's rule resolution and context injection follow a top-down hierarchy:

1. **Global Context:** `~/.gemini/GEMINI.md` (Note: Shares a path with Gemini CLI).
2. **Project Context:** `GEMINI.md` or `AGENT.md` located at the project root.
3. **Workspace Rules:** Granular Markdown files located in `.agent/rules/` or `.antigravity/rules.md`.
4. **Knowledge Base:** Any Markdown files located within the `.context/` directory.

---

## Global Configuration

Global configuration in Antigravity applies universal instructions to the AI agent across all repositories on your local machine.

### Step-by-Step Global Setup

**1. Create the Global Configuration File**
Because Antigravity shares underlying architecture with Gemini, it utilizes the Gemini global context file for overarching instructions.

```bash
mkdir -p ~/.gemini
touch ~/.gemini/GEMINI.md
```

**2. Define Global Rules**
Add your personal workflow rules, provider preferences, or failover conditions to this file. Antigravity will append this context to every session.
_Example `~/.gemini/GEMINI.md`:_

```markdown
# Global Agent Rules

- Always verify package versions before installing using `d_check_last_version`.
- Prefer semantic search (`a_semantic_search`) when researching the codebase.
- Never write implicit global state.
```

**3. Configure CLI Failover & Environment (Optional)**
If using the Antigravity CLI, you can define your multi-provider failover variables in your global shell profile.

```bash
export FAILOVER_ENABLED=true
```

_(Note: The CLI seamlessly attaches to the Antigravity IDE's language server, automatically inheriting the models and auth tokens configured in the IDE's `state.vscdb`)._

---

## Project-Specific Configuration

Project-specific configuration in Antigravity is designed around the concept of a "Cognitive Architecture." By defining rules and knowledge in specific folders, Antigravity automatically implements a "Plan → Trace → Act → Verify" loop.

### Step-by-Step Project Setup

**1. Provide Root Project Context (`GEMINI.md` / `AGENT.md`)**
Create a top-level context file at the root of your project.

```bash
cd /path/to/your/project
touch GEMINI.md
```

_Example `GEMINI.md`:_

```markdown
# Project Overview

This is a microservices-based backend written in Rust and Python.
All Python services must utilize type hints.
```

**2. Define Workspace Rules (`.antigravity/rules.md` or `.agent/rules/`)**
For complex, multi-agent workflows (like defining triggers for specific MCP tools), use the dedicated rules directory. These files support YAML frontmatter.

```bash
mkdir -p .agent/rules
touch .agent/rules/smart-mcp.md
```

_Example `smart-mcp.md`:_

```yaml
---
trigger: always_on
description: Mandatory usage of Smart Coding MCP tools for dependencies
---
# Smart Coding MCP Usage Rules
**Trigger:** When checking package versions.
**Action:** MUST use the `d_check_last_version` tool. DO NOT guess versions.
```

**3. Auto-Inject the Knowledge Base (`.context/`)**
Antigravity features a Zero-Config knowledge hub. Any Markdown file placed in the `.context/` directory is automatically scanned, indexed, and injected into the agent's prompt.

```bash
mkdir -p .context
touch .context/architecture.md
touch .context/database_schema.md
```

**4. Add Custom AI Skills (`.agents/skills/`)**
To extend Antigravity's capabilities, you can drop standard skill configurations (containing `SKILL.md`) into the project's skills folder. The agent discovers them automatically without registration.

```bash
mkdir -p .agents/skills/custom-deploy
touch .agents/skills/custom-deploy/SKILL.md
```

---

## Source Documentation References

- [Antigravity IDE Setup Docs](https://github.com/omar-haris/smart-coding-mcp/blob/main/docs/ide-setup/antigravity.md)
- [Antigravity Workspace Template](https://github.com/study8677/antigravity-workspace-template)
- [Awesome AGV (Antigravity Code Rules)](https://github.com/irahardianto/awesome-agv)
- [Antigravity CLI GitHub Repository](https://github.com/professional-ALFIE/antigravity-cli)
