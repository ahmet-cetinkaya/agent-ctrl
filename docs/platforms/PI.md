# Pi Platform Configuration

## Technical Overview

Pi (`pi`, package `@earendil-works/pi-coding-agent`, https://pi.dev) is a terminal-based AI coding agent CLI. It reads project instructions from an `AGENTS.md` file (and also accepts Claude Code's `CLAUDE.md` as an alias), discovers capabilities via the open [Agent Skills specification](https://agentskills.io/specification) (the same `SKILL.md` format Claude Code uses), and supports custom "prompt templates" that become `/name` slash commands.

Pi has no first-class agent/persona or subagent file format, and no native MCP server configuration file — both are add-on extension points instead of core, declarative config. `agent-ctrl` detects whether the corresponding community extension is installed and applies the artifact natively if so, degrading gracefully with a warning otherwise (see "Community Extensions for Missing Surfaces" below).

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
- Agents → written natively to `~/.pi/agent/agents/*.md` **if** the `pi-subagents` extension is detected as installed (see below); otherwise written into `~/.pi/agent/skills/` as skills, with a warning pointing to it.
- MCP servers → applied to `~/.pi/agent/mcp.json` **if** the `pi-mcp-adapter` extension is detected as installed (see below); otherwise not applied, with a warning pointing to it.

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
- Agents → written natively to `.pi/agents/*.md` **if** `pi-subagents` is detected as installed; otherwise `.pi/skills/` as skills, with a warning.
- MCP servers → applied to `.mcp.json` **if** `pi-mcp-adapter` is detected as installed; otherwise not applied, with a warning.

## Community Extensions for Missing Surfaces

Pi's core is intentionally minimal — MCP and native subagents are both add-ons, not built-in. `agent-ctrl` names the most widely adopted community extension for each surface (by npm download volume, verified via the npm registry API), and — for both — checks whether it is actually installed before deciding what to write:

| Surface         | Extension                                                        | Installs it                     | Native file it reads                                                                   |
| --------------- | ---------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| MCP servers     | [`pi-mcp-adapter`](https://github.com/nicobailon/pi-mcp-adapter) | `pi install npm:pi-mcp-adapter` | `.mcp.json` (project) / `~/.pi/agent/mcp.json` (user) — ~1.01M downloads/month         |
| Agents/personas | [`pi-subagents`](https://github.com/nicobailon/pi-subagents)     | `pi install npm:pi-subagents`   | `.pi/agents/*.md` (project) / `~/.pi/agent/agents/*.md` (user) — ~455K downloads/month |

**Both surfaces are detection-aware.** `agent-ctrl` checks whether the relevant extension is declared in Pi's own package manifest — `packages: [{ source: "npm:<extension>" }]` inside `.pi/settings.json` (project-installed) or `~/.pi/agent/settings.json` (personally-installed, applies to every project) — before deciding what to do:

- **Detected** → the artifact is written to the extension's native location (table above), in its expected shape (`{ "mcpServers": {...} }` for MCP; `name`/`description` + any pre-existing `tools`/`model` frontmatter for agents). The apply message confirms which extension(s) were used (e.g. "via pi-mcp-adapter", "via pi-subagents").
- **Not detected** → the same fallback as before: MCP servers are not applied (warning only); agents are written as skills (warning naming `pi-subagents` and its install command).

> [!NOTE]
> Detection is file-based and best-effort: it reads the declaration, not Pi's live runtime state, so a package declared in `.pi/settings.json` before "project trust" has been interactively granted is still treated as installed. A malformed or missing `settings.json` is treated as "not installed" and never interrupts the apply run.
>
> These are third-party community packages, not maintained by `agent-ctrl` or by Pi's authors (`earendil-works`). `agent-ctrl` never writes a `model` field into `.pi/agents/*.md` itself (see Model Frontmatter below) — an existing one is only preserved verbatim if the source agent already had it.

## Model Frontmatter

Pi has no per-skill or per-prompt `model` frontmatter — model selection is scoped to the CLI flag (`pi --model <provider/id>`) or `settings.json`'s `defaultProvider`/`defaultModel` fields, never to an individual skill or prompt file. `agent-ctrl` therefore drops the canonical `model`/`models` frontmatter field for all artifact kinds on this platform and reports why in the apply warnings.

## Source Documentation References

- [Pi GitHub Repository](https://github.com/earendil-works/pi)
- [Pi Documentation](https://pi.dev)
- [Agent Skills Specification](https://agentskills.io/specification)
- [pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) — community MCP extension
- [pi-subagents](https://github.com/nicobailon/pi-subagents) — community agent/persona extension
