# Project Index — agent-ctrl

> Complete documentation index for the `agent-ctrl-cli` project. Version 0.3.0.

## Quick Navigation

| Document                              | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)       | System design, layers, patterns, platform adapters |
| [Commands](COMMANDS.md)               | Complete CLI reference with examples               |
| [Configuration](CONFIGURATION.md)     | Directory structure, environment, artifact types   |
| [Integrations](INTEGRATIONS.md)       | Platform adapters, registries, templates           |
| [Development](DEVELOPMENT.md)         | Setup, workflows, guidelines                       |
| [Troubleshooting](TROUBLESHOOTING.md) | Common issues and solutions                        |
| [Contributing](CONTRIBUTING.md)       | Contribution guidelines                            |
| [PRD](PRD.md)                         | Product Requirements Document                      |

---

## System Overview

`agent-ctrl` is a centralized CLI tool for managing AI agent configurations using a **convention-over-configuration** directory pattern. It provides artifact management (rules, skills, agents, commands, MCP servers), remote catalog integration (SkillsMP for skills, Smithery for MCPs), and multi-platform synchronization (10 supported AI coding platforms).

### Package Info

| Field        | Value                          |
| ------------ | ------------------------------ |
| **Name**     | `agent-ctrl-cli`               |
| **Version**  | `0.3.0`                        |
| **License**  | GPL-3.0                        |
| **Runtime**  | Bun (ES modules)               |
| **Binaries** | `agent-ctrl`, `agent-ctrl-cli` |

### Tech Stack

| Component           | Technology     |
| ------------------- | -------------- |
| Runtime             | Bun            |
| Language            | TypeScript     |
| CLI Framework       | Commander.js   |
| Interactive Prompts | @clack/prompts |
| Terminal Colors     | picocolors     |
| Template Fetching   | giget          |
| Module System       | ES modules     |

---

## CLI Command Tree

```
agent-ctrl
├── [global options]
│   ├── -V, --version          Output the version number
│   ├── -v, --verbose          Enable verbose output
│   ├── -q, --quiet            Suppress warnings
│   └── -h, --help             Display help
│
├── init [path]                Initialize global config structure
│   └── --override             Re-initialize existing config root
│
├── rule
│   └── ls                     List installed rules
│
├── skill
│   ├── ls                     List local skills
│   ├── search <query>         Search SkillsMP registry
│   ├── sync                   Synchronize catalog from SkillsMP
│   ├── add <ref>              Activate a skill (e.g. skillsmp:code-review)
│   ├── rm <ref>               Deactivate a skill
│   └── update <ref>           Update an activated skill
│
├── agent
│   └── ls                     List agent personas
│
├── command
│   └── ls                     List commands
│
├── mcp
│   ├── ls                     List local MCP servers
│   ├── search <query>         Search Smithery registry
│   ├── sync                   Synchronize catalog from Smithery
│   ├── add <ref>              Activate an MCP (e.g. smithery:github)
│   ├── rm <ref>               Deactivate an MCP
│   └── update <ref>           Update an activated MCP
│
├── apply [platform]           Sync artifacts to platform config
│   ├── --dry-run              Preview without writing
│   ├── --override             Replace conflicting content
│   ├── --project              Target project scope
│   ├── --user                 Target user scope
│   ├── --path <root>          Custom config root
│   └── --no-prompt            Skip confirmation
│
└── profile
    ├── list                   List available profiles
    └── apply [platform] [profiles...]
        ├── --dry-run          Preview without writing
        ├── --override         Replace conflicting content
        └── --no-prompt        Skip confirmation
```

### Supported Platforms (Apply)

| ID            | Display Name | Adapter              |
| ------------- | ------------ | -------------------- |
| `antigravity` | Antigravity  | `AntigravityAdapter` |
| `claude`      | Claude Code  | `ClaudeApplyAdapter` |
| `codex`       | Codex        | `CodexAdapter`       |
| `cursor`      | Cursor       | `CursorAdapter`      |
| `forgecode`   | Forge Code   | `ForgeCodeAdapter`   |
| `gemini`      | Gemini Query | `GeminiAdapter`      |
| `kilo`        | Kilo Code    | `KiloAdapter`        |
| `opencode`    | OpenCode     | `OpenCodeAdapter`    |
| `qwen`        | Qwen         | `QwenAdapter`        |
| `windsurf`    | Windsurf     | `WindsurfAdapter`    |

---

## Source Code Map

### Core Layer (`src/core/`)

**Domain** (`src/core/domain/shared/`)

| Path             | Contents                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entities/`      | Rule, Skill, Agent, CatalogItem, ManagedIntegration, Profile, ProfileMetadata, Project, DiscoveryScope, CompatibilityAssessment, SyncReport, OperationLogEntry, SourceRegistry |
| `interfaces/`    | IApplyPlatformAdapter, ISkillsMpClient, ISmitheryRegistryClient, IAgentScanner, ICatalogStateStore, IFileValidator, IFileSystem, IMcpConfigLoader, IPlatformAdapter |
| `types/`         | Artifact, SupportedApplyPlatform                                                                                                                                    |
| `errors/`        | BaseError, UserError (exitCode=1), SystemError (exitCode=2), ProfileError                                                                                           |
| `constants/`     | errorIds.ts                                                                                                                                                         |
| `value-objects/` | ArtifactType, FileExtensions, Result                                                                                                                                |

**Application** (`src/core/application/features/`)

| Feature    | Commands                                                                   | Queries                                    |
| ---------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| `agent/`   | —                                                                          | ListAgentsQuery                            |
| `apply/`   | ApplyCommand, ApplyProfileCommand, ProfileListCommand                      | —                                          |
| `command/` | —                                                                          | ListCommandsQuery                          |
| `init/`    | InitCommand                                                                | —                                          |
| `mcp/`     | AddMcpCommand, RemoveMcpCommand, SyncMcpCatalogCommand, UpdateMcpCommand   | ListMcpServersQuery, SearchMcpCatalogQuery |
| `rule/`    | —                                                                          | ListRulesQuery                             |
| `skill/`   | AddSkillCommand, RemoveSkillCommand, SyncSkillsCommand, UpdateSkillCommand | ListSkillsQuery, SearchSkillsQuery         |

### Infrastructure Layer (`src/infrastructure/`)

**Platform Adapters** (`src/infrastructure/features/<platform>/adapters/`)

| Platform    | File(s)                                     |
| ----------- | ------------------------------------------- |
| antigravity | `AntigravityAdapter.ts`                     |
| claude      | `ClaudeAdapter.ts`, `ClaudeApplyAdapter.ts` |
| codex       | `CodexAdapter.ts`                           |
| cursor      | `CursorAdapter.ts`                          |
| forgecode   | `ForgeCodeAdapter.ts`                       |
| gemini      | `GeminiAdapter.ts`                          |
| kilo        | `KiloAdapter.ts`                            |
| opencode    | `OpenCodeAdapter.ts`                        |
| qwen        | `QwenAdapter.ts`                            |
| windsurf    | `WindsurfAdapter.ts`                        |

**Apply Framework** (`src/infrastructure/features/apply/adapters/`)

| Component                 | Purpose                                                                      |
| ------------------------- | ---------------------------------------------------------------------------- |
| `BaseTextApplyAdapter`    | Abstract base for marker-based markdown merge                                |
| `PlatformAdapterRegistry` | Factory-based adapter registration                                           |
| `ApplySourceLoader`       | Scans .agent-ctrl/ for artifacts                                             |
| `ApplyMergePolicy`        | Determines how content is merged                                             |
| `ProfileMerger`           | Merges profile artifacts with base config                                    |
| `ProfileScanner`          | Scans profile directories                                                    |
| `ProfileMetadataReader`   | Reads optional `profile.yaml` display metadata (name, description, tags/category) |
| Renderers                 | `IAgentRenderer`, `ICommandRenderer`, `IMcpConfigRenderer` + implementations |
| Utilities                 | `PlatformSyncUtils`, `CommandScopePrecedenceResolver`, `ManagedTextSection`  |

**Catalog System** (`src/infrastructure/features/catalog/`)

| Subdirectory     | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `clients/`       | SkillsMpClient, SmitheryRegistryClient   |
| `caching/`       | CatalogStateFileStore, cache persistence |
| `compatibility/` | Platform compatibility assessment        |
| `errors/`        | Catalog-specific error types             |
| `reporting/`     | Sync operation reports                   |
| `scopes/`        | Discovery scope management               |

**MCP System** (`src/infrastructure/features/mcp/`)

| Subdirectory     | Purpose                                    |
| ---------------- | ------------------------------------------ |
| `loaders/`       | McpServerAggregator, file discovery        |
| `metadata/`      | Server metadata management                 |
| `parsers/`       | JSON config parsing                        |
| `registries/`    | Server registration                        |
| `reporting/`     | MCP loading reports                        |
| `interpolation/` | `${VAR}` environment variable substitution |
| `validators/`    | Config validation                          |

**Scanners** (`src/infrastructure/features/*/scanners/`)

| Scanner        | Location            | Scans                                                  |
| -------------- | ------------------- | ------------------------------------------------------ |
| RuleScanner    | `rule/scanners/`    | `.md`/`.markdown` in `rules/`                          |
| SkillScanner   | `skill/scanners/`   | `SKILL.md` dirs in `skills/`                           |
| AgentScanner   | `agent/scanners/`   | `.md`/`.markdown` in `agents/`                         |
| CommandScanner | `command/scanners/` | `.md`/`.markdown` in `commands/` (recursive, depth 20) |
| ProfileScanner | `apply/adapters/`   | Profile directories                                    |

**Shared** (`src/infrastructure/shared/`)

| Path                         | Purpose                   |
| ---------------------------- | ------------------------- |
| `file-system/NodeFileSystem` | Node.js fs abstraction    |
| `utils/PathResolver`         | Path resolution utilities |
| `utils/PathSecurity`         | Path traversal prevention |
| `validation/FileValidator`   | File validation utilities |

### Presentation Layer (`src/presentation/`)

**CLI** (`src/presentation/cli/`)

| Path                             | Purpose                                  |
| -------------------------------- | ---------------------------------------- |
| `index.ts`                       | Entry point, command registration        |
| `features/*/commands/`           | CLI command definitions per feature      |
| `shared/handlers/resultHandler`  | Result processing and exit code handling |
| `shared/middleware/errorHandler` | Global error handling                    |
| `shared/utils/LogService`        | Structured logging                       |
| `shared/utils/PromptService`     | Interactive prompts (@clack/prompts)     |
| `shared/utils/configRoot`        | Config root resolution                   |
| `shared/utils/globalOptions`     | Global option parsing                    |
| `shared/utils/catalogOutput`     | Catalog display formatting               |

---

## Domain Model Relationships

```
                    ┌─────────────┐
                    │   Profile   │
                    │ name, path, │
                    │ configRoot  │
                    └──────┬──────┘
                           │ references
                           ▼
┌──────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Rule   │    │   CatalogItem    │    │     Skill       │
│ filename │    │ catalogKey,      │    │ directoryName   │
│ path     │◄───│ registryId,      │───►│ path            │
│ type     │    │ itemType,        │    │ type            │
└──────────┘    │ compatibility,   │    └─────────────────┘
                │ activation       │
┌──────────┐    └────────┬─────────┘    ┌─────────────────┐
│  Agent   │             │              │     Agent       │
│ filename │             │ manages      │ filename        │
│ path     │             ▼              │ path            │
│ type     │    ┌──────────────────┐    │ type            │
└──────────┘    │ManagedIntegration│    └─────────────────┘
                │ managedId,       │
┌──────────┐    │ localPath, state,│
│ Command  │    │ version          │
│ path     │    └────────┬─────────┘
│ content  │             │ tracks
└──────────┘             ▼
                ┌──────────────────┐
                │ DiscoveryScope   │
                │ scopeType,       │
                │ query, category  │
                └──────────────────┘
```

### Key Relationships

- **CatalogItem** ↔ **ManagedIntegration**: One-to-many; a catalog item can have multiple managed integrations (activated on different machines)
- **DiscoveryScope** → **CatalogItem**: Scopes define which items are synchronized
- **Profile** → Artifacts: Profiles reference subsets of rules, skills, agents, commands, MCPs
- **CompatibilityAssessment** → **CatalogItem**: Each item has per-platform compatibility state

---

## Config Root Resolution

```
AGENT_CTRL_HOME env var ──► exists? ──yes──► use it
                               │
                              no
                               ▼
                        ~/.agent-ctrl (default)
```

### Config Structure

```
<config-root>/
├── .env                  # API keys (SKILLSMP_API_KEY, SMITHERY_API_KEY)
├── .env.example          # Template
├── .gitignore            # Git patterns
├── README.md             # Documentation
├── rules/                # Rule files (.md)
├── skills/               # Skill directories (SKILL.md)
├── agents/               # Agent personas (.md)
├── commands/             # Commands (.md, recursive)
├── mcps/                 # MCP configs (JSON)
│   └── .env              # MCP-specific env vars
├── profiles/             # Configuration profiles
│   └── <name>/           # Profile directory
│       └── profile.yaml  # Optional: display metadata (name, description, tags)
└── catalog/              # Cached catalog state (managed)
    └── catalog.json      # CatalogStateFileStore output
```

---

## Apply Flow

```
┌──────────────┐     ┌───────────────────┐     ┌────────────────────┐
│ CLI: apply   │────►│ ApplyCommand      │────►│ PlatformAdapter    │
│ <platform>   │     │ .execute()        │     │ Registry           │
└──────────────┘     └───────────────────┘     └────────┬───────────┘
                                                        │
                              ┌─────────────────────────┼─────────────────────────┐
                              ▼                         ▼                         ▼
                    ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
                    │ ApplySourceLoader│      │ BaseTextApply    │      │ Direct           │
                    │ scans artifacts  │      │ Adapter          │      │ Implementation   │
                    └──────────────────┘      │ marker-merge     │      │ (OpenCode, etc)  │
                                              └──────────────────┘      └──────────────────┘
                                                        │                         │
                              ┌─────────────────────────┼─────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │ Write platform   │
                    │ native config    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ ApplyIntegration │
                    │ Result           │
                    │ status: success  │
                    │         unchanged│
                    └──────────────────┘
```

### Adapter Patterns

1. **BaseTextApplyAdapter** — For markdown-based platforms. Uses `<!-- agent-ctrl:<platform>:start -->` / `<!-- agent-ctrl:<platform>:end -->` markers for deterministic merge.
2. **Direct IApplyPlatformAdapter** — For platforms with complex config (multiple files, JSON). Implements `resolveTarget()` and `applyApplyIntegration()` directly.

---

## Catalog System

### SkillsMP Client

| Property  | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Base URL  | `https://skillsmp.com` (overridable: `AGENT_CTRL_SKILLSMP_BASE_URL`) |
| Auth      | `SKILLSMP_API_KEY` or `SKILLSMP_TOKEN`                               |
| Search    | `GET /api/v1/skills/search`                                          |
| AI Search | `GET /api/v1/skills/ai-search`                                       |
| Details   | Direct GitHub content fetch                                          |
| Timeout   | 15s                                                                  |

### Smithery Registry Client

| Property | Value                                                                        |
| -------- | ---------------------------------------------------------------------------- |
| Base URL | `https://registry.smithery.ai` (overridable: `AGENT_CTRL_SMITHERY_BASE_URL`) |
| Auth     | `SMITHERY_API_KEY` or `SMITHERY_TOKEN`                                       |
| List     | `GET /servers`                                                               |
| Details  | `GET /servers/{id}`                                                          |
| Timeout  | 15s                                                                          |

### Credential Precedence

1. `--api-key` flag (single command)
2. `.agent-ctrl/.env` file
3. System environment variables

---

## MCP Loading Pipeline

```
Phase 1: Discovery ──► Find all .json files in mcps/
                          │
Phase 2: Env Loading ──► Load mcps/.env
                          │
Phase 3: Processing ──► Parse JSON, interpolate ${VAR}
                          │
Phase 4: Conflicts ──► Detect duplicate server names
                          │
Phase 5: Report ──► Generate loading summary
```

---

## Error Handling

| Error Type     | Exit Code             | Usage                                              |
| -------------- | --------------------- | -------------------------------------------------- |
| `UserError`    | 1                     | Invalid input, missing credentials, file not found |
| `SystemError`  | 2                     | Internal failure, unexpected state                 |
| `ProfileError` | 1 (extends UserError) | Profile-specific errors                            |

### Result Pattern

```typescript
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
```

All use cases return `Result<T, Error>`. CLI commands handle results via `resultHandler` which maps errors to exit codes.

---

## Development Workflows

| Command                   | Purpose                     |
| ------------------------- | --------------------------- |
| `bun run dev`             | Run CLI in development mode |
| `bun run build`           | Build to `dist/`            |
| `bun run start`           | Run built version           |
| `bun test`                | Run tests                   |
| `bun run lint`            | Run linter                  |
| `bun run lint:fix`        | Fix lint issues             |
| `bun run format`          | Format code                 |
| `bun run release:version` | Bump version                |
| `bun run release:tag`     | Create git tag              |
| `bun run release:npm`     | Publish to npm              |

---

## Cross-Reference Index

### By Feature

| Feature  | Core                                              | Infrastructure                                      | CLI                                      |
| -------- | ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------- |
| Init     | `init/InitCommand`                                | —                                                   | `init/commands/init`                     |
| Rules    | —                                                 | `rule/scanners/RuleScanner`                         | `rule/commands/rule`, `rule_ls`          |
| Skills   | `skill/*Commands`, `skill/*Queries`               | `skill/scanners/`, `catalog/clients/SkillsMpClient` | `skill/commands/skill*`                  |
| Agents   | `agent/ListAgentsQuery`                           | `agent/scanners/AgentScanner`                       | `agent/commands/agent`, `agent_ls`       |
| Commands | `command/ListCommandsQuery`                       | `command/scanners/CommandScanner`                   | `command/commands/command`, `command_ls` |
| MCP      | `mcp/*Commands`, `mcp/*Queries`                   | `mcp/`, `catalog/clients/SmitheryRegistryClient`    | `mcp/commands/mcp*`                      |
| Apply    | `apply/ApplyCommand`                              | `apply/adapters/`, `features/*/adapters/`           | `apply/commands/apply`                   |
| Profiles | `apply/ApplyProfileCommand`, `ProfileListCommand` | `apply/adapters/ProfileScanner`, `ProfileMerger`    | `profile/commands/profile`               |

### By Platform Adapter

| Platform    | Adapter File                              | Pattern               |
| ----------- | ----------------------------------------- | --------------------- |
| OpenCode    | `opencode/adapters/OpenCodeAdapter`       | Direct implementation |
| Claude Code | `claude/adapters/ClaudeApplyAdapter`      | BaseTextApplyAdapter  |
| Gemini      | `gemini/adapters/GeminiAdapter`           | Direct implementation |
| Qwen        | `qwen/adapters/QwenAdapter`               | Direct implementation |
| Kilo Code   | `kilo/adapters/KiloAdapter`               | Direct implementation |
| Antigravity | `antigravity/adapters/AntigravityAdapter` | Direct implementation |
| Codex       | `codex/adapters/CodexAdapter`             | Direct implementation |
| Cursor      | `cursor/adapters/CursorAdapter`           | Direct implementation |
| Windsurf    | `windsurf/adapters/WindsurfAdapter`       | Direct implementation |
| Forge Code  | `forgecode/adapters/ForgeCodeAdapter`     | BaseTextApplyAdapter  |
