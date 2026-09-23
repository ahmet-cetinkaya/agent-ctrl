# Pi Platform Configuration

## Technical Overview

Pi (`pi`, package `@earendil-works/pi-coding-agent`, https://pi.dev) is a terminal-based AI coding agent CLI. It reads project instructions from an `AGENTS.md` file (and also accepts Claude Code's `CLAUDE.md` as an alias), discovers capabilities via the open [Agent Skills specification](https://agentskills.io/specification) (the same `SKILL.md` format Claude Code uses), and supports custom "prompt templates" that become `/name` slash commands.

Pi has no first-class agent/persona or subagent file format, and no native MCP server configuration file — both are project-trust-gated extension points instead of declarative config. `agent-ctrl` degrades these two surfaces accordingly (see below).

Configuration is split between a global agent directory and a project-local directory that is only loaded after "project trust" is granted:

1. **Project Configuration (`.pi/`):** `settings.json`, `SYSTEM.md`/`APPEND_SYSTEM.md`, `extensions/`, `skills/`, `prompts/`, `themes/` — loaded from the project root's `.pi/` directory.
2. **Project Context (`AGENTS.md` / `CLAUDE.md`):** Auto-loaded conversational instructions at the project root (outside `.pi/`).
3. **Global Agent Directory (`~/.pi/agent/`):** Same file set as the project directory (`settings.json`, `skills/`, `prompts/`, etc.), plus the global `AGENTS.md`/`CLAUDE.md` instructions, applied to every session unless overridden by project-local files. Overridable via the `PI_CODING_AGENT_DIR` environment variable.

---

## Global Configuration

```bash
mkdir -p ~/.pi/agent/skills ~/.pi/agent/prompts
touch ~/.pi/agent/AGENTS.md
```

`agent-ctrl apply pi --scope user` writes:

- Rules → `~/.pi/agent/AGENTS.md` (managed section, upserted between markers).
- Commands → `~/.pi/agent/prompts/<name>.md` (frontmatter: `description`).
- Skills → `~/.pi/agent/skills/<skill-id>/SKILL.md` (+ assets, copied verbatim).
- Agents → written into `~/.pi/agent/skills/` as skills, since Pi has no persona concept (a warning is reported).
- MCP servers → **not applied**; Pi has no native MCP configuration surface (a warning is reported).

---

## Project-Specific Configuration

```bash
mkdir -p .pi/skills .pi/prompts
touch AGENTS.md
```

`agent-ctrl apply pi` (project scope, the default when a project-local surface is detected) writes:

- Rules → `AGENTS.md` at the project root (managed section, upserted between markers).
- Commands → `.pi/prompts/<name>.md`.
- Skills → `.pi/skills/<skill-id>/SKILL.md` (+ assets).
- Agents → `.pi/skills/` as skills (warning reported — no native persona surface).
- MCP servers → not applied (warning reported).

## Model Frontmatter

Pi has no per-skill or per-prompt `model` frontmatter — model selection is scoped to the CLI flag (`pi --model <provider/id>`) or `settings.json`'s `defaultProvider`/`defaultModel` fields, never to an individual skill or prompt file. `agent-ctrl` therefore drops the canonical `model`/`models` frontmatter field for all artifact kinds on this platform and reports why in the apply warnings.

## Source Documentation References

- [Pi GitHub Repository](https://github.com/earendil-works/pi)
- [Pi Documentation](https://pi.dev)
- [Agent Skills Specification](https://agentskills.io/specification)
