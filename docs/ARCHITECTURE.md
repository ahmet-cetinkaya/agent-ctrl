# Architecture

## System Architecture

### Clean Architecture Layers

```
src/
├── core/
│   ├── domain/              # Domain models and entities
│   │   ├── shared/entities/ # Rule, Skill, Agent, catalog state entities
│   │   └── shared/interfaces/
│   └── application/         # Use cases and business logic
│       └── features/
│           ├── skill/
│           └── mcp/
├── infrastructure/          # External integrations
│   └── features/
│       ├── catalog/         # Cache, remote clients, compatibility, scope planning
│       ├── skill/           # Skill scanners, metadata, registries
│       └── mcp/             # MCP loaders, metadata, registries, validators
└── presentation/
    └── cli/                 # Commander.js interface
        └── features/
            ├── skill/
            └── mcp/
```

### The Standard Directory Pattern

The CLI operates on a project-local structure that defines agent behavior:

```
.
├── rules/              # Behavioral Rules (Markdown)
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
└── .agent-ctrl/
    ├── mcps/           # Managed MCP configuration files
    └── .catalog/       # Sync cache, discovery scopes, managed source metadata
```

## Adapter Pattern

Each target platform uses a specialized adapter to sync `.agent-ctrl` artifacts into platform-specific native configuration surfaces:

| Platform        | Adapter              | Strategy                                                        | Output surfaces                                        |
| --------------- | -------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| **OpenCode**    | `OpenCodeAdapter`    | Shared guidance plus native directories                         | `AGENTS.md`, `.opencode/commands`, `.opencode/*`       |
| **Gemini**      | `GeminiAdapter`      | Guidance, TOML commands, MCP settings                           | `GEMINI.md`, `.gemini/commands`, `.gemini/*`           |
| **Qwen**        | `QwenAdapter`        | Guidance plus MCP settings                                      | `QWEN.md`, `.qwen/settings.json`                       |
| **Kilo**        | `KiloAdapter`        | Rules, workflows, skills                                        | `.kilocode/rules`, `.kilocode/workflows`               |
| **Antigravity** | `AntigravityAdapter` | Workspace rules/workflows or global doc                         | `.agent/rules`, `.agent/workflows`, `GEMINI.md`        |
| **Codex**       | `CodexAdapter`       | Shared guidance, skills (commands mapped to skills), MCP config | `AGENTS.md`, `.agents/skills`, `.codex/config.toml`    |
| **Cursor**      | `CursorAdapter`      | Project rules and skills                                        | `.cursor/rules`, `.cursor/skills`                      |
| **Windsurf**    | `WindsurfAdapter`    | Shared guidance, workflows, skills                              | `AGENTS.md`, `.windsurf/workflows`, `.windsurf/skills` |

### Adapter Interface

```typescript
interface IApplyPlatformAdapter {
  // Resolve target path and scope (project/user) for selected platform
  resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget>;

  // Apply deterministic native-platform synchronization
  applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult>;
}
```

## Core Components

### Config Loader

**Location:** `src/infrastructure/config/`

- Reads `mcp.json` with Zod schema validation
- Scans directory structure for artifacts
- Caches parsed configuration for performance

### Registry Clients

**Location:** `src/infrastructure/features/catalog/clients/`

- **SkillsMP:** Scoped skill discovery through the documented search API, plus page-backed installation metadata lookup
- **Smithery:** Paginated MCP registry traversal and server-detail retrieval
- Shared cache/state lives under `src/infrastructure/features/catalog/caching/`

### Artifact Scanners

**Location:** `src/core/application/artifacts/`

Each artifact type has a dedicated scanner:

- `RuleScanner` - Parses Markdown files in `rules/`
- `SkillScanner` - Validates `SKILL.md` standard in `skills/`
- `CommandScanner` - Indexes commands in `commands/` (recursive)
- `AgentScanner` - Loads agent personas from `agents/`

## Design Patterns

### Convention over Configuration

The directory structure **IS** the configuration. No complex config files - just follow the standard pattern.

### Modular Artifacts

- **Rules:** Discrete Markdown files that can be composed
- **Skills:** Self-contained via SKILL.md standard
- **Agents:** Reusable persona definitions

### Validation Chain

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Zod Schema  │ -> │ File Scanner │ -> │ Validation  │
│ Validation  │    │ & Parser     │    │ Result      │
└─────────────┘    └──────────────┘    └─────────────┘
```

## Tech Stack

| Component           | Technology   |
| ------------------- | ------------ |
| Runtime             | Bun          |
| Language            | TypeScript   |
| CLI Framework       | Commander.js |
| Validation          | Zod          |
| Interactive Prompts | Inquirer.js  |
| Template Fetching   | giget        |
| Terminal UI         | ora, chalk   |
