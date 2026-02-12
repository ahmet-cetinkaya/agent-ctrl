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

Each target platform uses a specialized adapter to transform standard artifacts into platform-specific formats:

| Platform                 | Adapter         | Strategy                                                    | Output                      |
| ------------------------ | --------------- | ----------------------------------------------------------- | --------------------------- |
| **Claude Code**          | `ClaudeAdapter` | Symmetric mapping of `rules`, `skills`, `commands`          | `~/.claude/config.json`     |
| **Gemini / Antigravity** | `GeminiAdapter` | Rules → System Instructions, Skills → Function Declarations | API Context / System Prompt |
| **Codex**                | `CursorAdapter` | Injects `rules/` and `agents/` into context                 | `.cursorrules`              |
| **Generic (MCP)**        | `McpAdapter`    | Standardized MCP settings                                   | `mcp_settings.json`         |

### Adapter Interface

```typescript
interface Adapter {
  // Transform standard artifacts to platform-specific format
  apply(artifacts: Artifacts): Promise<ConfigOutput>;

  // Validate platform-specific requirements
  validate(config: ConfigOutput): ValidationResult;

  // Get target platform name
  getPlatform(): string;
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
