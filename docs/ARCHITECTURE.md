# Architecture

## System Architecture

### Clean Architecture Layers

```
src/
├── core/
│   ├── domain/              # Domain models and entities
│   │   ├── Rule.ts
│   │   ├── Skill.ts
│   │   ├── Agent.ts
│   │   └── McpConfig.ts
│   └── application/         # Use cases and business logic
│       ├── init.ts
│       ├── apply.ts
│       ├── build.ts
│       └── artifacts/       # Artifact management use cases
│           ├── rule.ts
│           ├── skill.ts
│           ├── command.ts
│           └── agent.ts
├── infrastructure/          # External integrations
│   ├── registry/            # SkillsMP, Git templates
│   ├── filesystem/          # File I/O, directory scanning
│   └── validation/          # Zod schemas
└── presentation/
    └── cli/                 # Commander.js interface
        └── index.ts
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
└── mcp.json            # MCP Server Configuration
```

## Adapter Pattern

Each target platform uses a specialized adapter to apply a managed `appy` integration artifact into platform-specific configuration surfaces:

| Platform        | Adapter              | Strategy                                     | Output                        |
| --------------- | -------------------- | -------------------------------------------- | ----------------------------- |
| **OpenCode**    | `OpenCodeAdapter`    | Managed command file upsert                  | `.opencode/commands/appy.md`  |
| **Gemini**      | `GeminiAdapter`      | Managed TOML command upsert                  | `.gemini/commands/appy.toml`  |
| **Qwen**        | `QwenAdapter`        | Managed TOML command upsert                  | `.qwen/commands/appy.toml`    |
| **Kilo**        | `KiloAdapter`        | Managed workflow content upsert              | `.kilocode/workflows/appy.md` |
| **Antigravity** | `AntigravityAdapter` | Managed rules/workflow surface update        | `.antigravity/rules/appy.md`  |
| **Codex**       | `CodexAdapter`       | Managed skill/config guidance surface update | `.codex/skills/appy/SKILL.md` |
| **Cursor**      | `CursorAdapter`      | Managed rules surface update                 | `.cursor/rules/appy.mdc`      |
| **Windsurf**    | `WindsurfAdapter`    | Managed rules/workflow surface update        | `.windsurf/rules/appy.md`     |

### Adapter Interface

```typescript
interface IAppyPlatformAdapter {
  // Resolve target path and scope (project/user) for selected platform
  resolveTarget(projectPath: string): Promise<AppyConfigTarget>;

  // Apply deterministic appy integration
  applyAppyIntegration(request: AppyIntegrationRequest): Promise<AppyIntegrationResult>;
}
```

## Core Components

### Config Loader

**Location:** `src/infrastructure/config/`

- Reads `mcp.json` with Zod schema validation
- Scans directory structure for artifacts
- Caches parsed configuration for performance

### Registry Client

**Location:** `src/infrastructure/registry/`

- **SkillsMP:** Skill discovery, installation, updates
- **Git Templates:** Remote project scaffolding via `giget`
- Supports GitHub, GitLab, Bitbucket

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
