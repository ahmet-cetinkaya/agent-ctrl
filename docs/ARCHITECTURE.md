# Architecture

## System Architecture

### Clean Architecture Layers

```
src/
├── core/
│   ├── domain/              # Domain models and entities
│   │   └── shared/
│   │       ├── entities/    # Rule, Skill, Agent, CatalogItem, Profile, etc.
│   │       ├── interfaces/  # IPlatformAdapter, ISkillsMpClient, ISmitheryRegistryClient, etc.
│   │       ├── types/       # Artifact, SupportedApplyPlatform, Result
│   │       ├── errors/      # BaseError, UserError, SystemError, ProfileError
│   │       └── constants/   # Error IDs
│   └── application/         # Use cases and business logic
│       └── features/
│           ├── agent/       # ListAgentsQuery
│           ├── apply/       # ApplyCommand, ApplyProfileCommand, ProfileListCommand, ProfileMerger
│           ├── command/     # ListCommandsQuery
│           ├── init/        # InitCommand
│           ├── mcp/         # Add/Remove/Sync/Update MCP commands, List/Search queries
│           ├── rule/        # ListRulesQuery
│           └── skill/       # Add/Remove/Sync/Update Skill commands, List/Search queries
├── infrastructure/          # External integrations and platform adapters
│   ├── features/
│   │   ├── agent/scanners/  # AgentScanner
│   │   ├── apply/adapters/  # BaseTextApplyAdapter, PlatformAdapterRegistry, renderers, merge policies
│   │   ├── catalog/         # clients/, caching/, compatibility/, errors/, reporting/, scopes/
│   │   ├── command/scanners/# CommandScanner
│   │   ├── mcp/             # loaders/, metadata/, parsers/, registries/, interpolation/, validators/
│   │   ├── rule/scanners/   # RuleScanner
│   │   ├── skill/           # scanners/, metadata/, registries/
│   │   └── projects/scanners/# DirectoryScanner
│   ├── shared/              # file-system/, utils/, validation/
│   └── templates/           # sampleConfig.json
│   # Platform adapters (each under infrastructure/features/<platform>/adapters/):
│   ├── antigravity/         # AntigravityAdapter
│   ├── claude/              # ClaudeAdapter, ClaudeApplyAdapter
│   ├── codex/               # CodexAdapter
│   ├── cursor/              # CursorAdapter
│   ├── forgecode/           # ForgeCodeAdapter
│   ├── gemini/              # GeminiAdapter
│   ├── kilo/                # KiloAdapter
│   ├── opencode/            # OpenCodeAdapter
│   ├── qwen/                # QwenAdapter
│   └── windsurf/            # WindsurfAdapter
└── presentation/
    └── cli/                 # Commander.js interface
        ├── features/        # Command registrations per artifact type
        └── shared/          # handlers/, middleware/, utils/
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
├── commands/           # Grouped Commands (Markdown)
│   ├── dev/
│   │   └── fix-lint.md
│   └── explain.md
├── agents/             # Agent Personas
│   └── architect.md
├── mcps/               # MCP server configurations (JSON)
│   └── .env            # MCP environment variables
├── profiles/           # Configuration profiles (optional)
│   └── default/        # Profile directory with artifact references
│       └── profile.yaml  # Optional: display metadata (name, description, tags)
└── .agent-ctrl/
    ├── catalog/        # Sync cache, discovery scopes, managed source metadata
    └── README.md       # Config root documentation
```

## Adapter Pattern

Each target platform uses a specialized adapter to sync `.agent-ctrl` artifacts into platform-specific native configuration surfaces:

| Platform        | Adapter              | Strategy                                                        | Output surfaces                                          |
| --------------- | -------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| **OpenCode**    | `OpenCodeAdapter`    | Shared guidance plus native directories                         | `AGENTS.md`, `.opencode/commands`, `opencode.json`       |
| **Claude Code** | `ClaudeApplyAdapter` | Shared guidance with marker-based merge                         | `CLAUDE.md`                                              |
| **Gemini**      | `GeminiAdapter`      | Guidance, TOML commands, MCP settings                           | `GEMINI.md`, `.gemini/commands`, `.gemini/settings.json` |
| **Qwen**        | `QwenAdapter`        | Guidance plus MCP settings                                      | `QWEN.md`, `.qwen/settings.json`                         |
| **Kilo**        | `KiloAdapter`        | Rules, workflows, skills                                        | `.kilocode/rules`, `.kilocode/workflows`                 |
| **Antigravity** | `AntigravityAdapter` | Workspace rules/workflows or global doc                         | `.agent/rules`, `.agent/workflows`, `GEMINI.md`          |
| **Codex**       | `CodexAdapter`       | Shared guidance, skills (commands mapped to skills), MCP config | `AGENTS.md`, `.agents/skills`, `.codex/config.toml`      |
| **Cursor**      | `CursorAdapter`      | Project rules and skills                                        | `.cursor/rules`, `.cursor/skills`                        |
| **Windsurf**    | `WindsurfAdapter`    | Shared guidance, workflows, skills                              | `AGENTS.md`, `.windsurf/workflows`, `.windsurf/skills`   |
| **Forge Code**  | `ForgeCodeAdapter`   | Shared guidance with marker-based merge                         | `FORGECODE.md`                                           |

### Adapter Interface

```typescript
interface IApplyPlatformAdapter {
  readonly platformName: SupportedApplyPlatform;

  // Resolve target path and scope (project/user) for selected platform
  resolveTarget(projectPath: string, request?: ApplyIntegrationRequest): Promise<ApplyConfigTarget>;

  // Apply deterministic native-platform synchronization
  applyApplyIntegration(request: ApplyIntegrationRequest): Promise<ApplyIntegrationResult>;
}
```

**Key types:**

- `ApplyConfigTarget`: `{ configPath, scope: "project" | "user", surface }`
- `ApplyIntegrationRequest`: `{ projectPath, dryRun?, override?, targetScope?, userConfigRootPath?, mergedSnapshot? }`
- `ApplyIntegrationResult`: `{ platform, configPath, scope, surface, status: "success" | "unchanged", message, artifactCounts?, fileChanges?, warnings? }`

### Adapter Patterns

Two adapter patterns are used:

1. **`BaseTextApplyAdapter`** - Abstract base for text-based platforms using marker-based merge in markdown files (e.g., Claude, Forge Code)
2. **Direct `IApplyPlatformAdapter` implementations** - For platforms with complex config structures (e.g., OpenCode writes to multiple files including `opencode.json`)

All adapters are registered via `PlatformAdapterRegistry` using factory functions.

## Core Components

### Config Loader

**Location:** `src/presentation/cli/shared/utils/configRoot.ts`

- Resolves config root from `AGENT_CTRL_HOME` env var or defaults to `~/.agent-ctrl`
- `resolveConfigRoot(targetPath?)` returns the configuration root directory
- `resolveConfigParent()` returns the parent directory of the config root

### Registry Clients

**Location:** `src/infrastructure/features/catalog/clients/`

- **SkillsMP:** Scoped skill discovery through the search API (`/api/v1/skills/search` and `/api/v1/skills/ai-search`), plus direct GitHub content fetching for skill details. Base URL overridable via `AGENT_CTRL_SKILLSMP_BASE_URL`.
- **Smithery:** Paginated MCP registry traversal (`/servers`) and server-detail retrieval (`/servers/{id}`). Base URL overridable via `AGENT_CTRL_SMITHERY_BASE_URL`.

Shared cache/state lives under `src/infrastructure/features/catalog/caching/` and is persisted to `<config-root>/catalog/` via `CatalogStateFileStore`.

### Artifact Scanners

**Location:** `src/infrastructure/features/*/scanners/`

Each artifact type has a dedicated scanner:

- `RuleScanner` - Parses Markdown files in `rules/` (`.md`/`.markdown`)
- `SkillScanner` - Validates `SKILL.md` standard in `skills/` (directory-based)
- `CommandScanner` - Indexes commands in `commands/` (recursive, max depth 20, symlink-safe)
- `AgentScanner` - Loads agent personas from `agents/` (`.md`/`.markdown`)
- `ProfileScanner` - Scans profile directories for combined artifact snapshots
- `ProfileMetadataReader` - Reads optional `profile.yaml` display metadata (name, description, tags/category); falls back to `Uncategorized` when absent

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
│ Input       │ -> │ File Scanner │ -> │ Validation  │
│ Validation  │    │ & Parser     │    │ Result      │
└─────────────┘    └──────────────┘    └─────────────┘
```

## Domain Entities

**Location:** `src/core/domain/shared/entities/`

| Entity                    | Purpose                                                                   |
| ------------------------- | ------------------------------------------------------------------------- |
| `Rule`                    | Rule artifact with filename, path, type                                   |
| `Skill`                   | Skill artifact with directory name, path, type                            |
| `Agent`                   | Agent persona artifact with filename, path, type                          |
| `Profile`                 | Configuration profile with name, path, configRoot, artifactPaths          |
| `ProfileMetadata`         | Optional display metadata for a profile: displayName, description, tags, category (from `profile.yaml`) |
| `CatalogItem`             | Registry catalog entry with metadata, compatibility, and activation state |
| `ManagedIntegration`      | Activated skill/MCP with lifecycle state and version tracking             |
| `DiscoveryScope`          | Discovery scope configuration for registry sync                           |
| `CompatibilityAssessment` | Platform compatibility evaluation for catalog items                       |
| `SyncReport`              | Sync operation result with per-item status                                |
| `OperationLogEntry`       | Audit log entry for catalog operations                                    |

### Catalog Types

**Location:** `src/core/domain/shared/entities/CatalogTypes.ts`

- `RegistryId`: `"skillsmp" | "smithery"`
- `ItemType`: `"skill" | "mcp"`
- `CompatibilityState`: `"compatible" | "incompatible" | "unknown"`
- `ActivationState`: `"inactive" | "active" | "update-available" | "activation-blocked"`
- `AvailabilityState`: `"available" | "unavailable" | "removed"`
- `ManagedIntegrationState`: `"active" | "inactive" | "update-available" | "unavailable" | "failed"`
- `AuthState`: `"unknown" | "not-required" | "configured" | "missing" | "invalid" | "expired"`
- `RegistrySyncStatus`: `"idle" | "success" | "partial" | "failed" | "throttled" | "cached"`
- `DiscoveryScopeType`: `"global" | "query" | "category" | "tracked-items"`
- `OperationType`: `"sync" | "search" | "activate" | "deactivate" | "update"`
- `OperationStatus`: `"success" | "partial" | "failed" | "skipped" | "throttled" | "unchanged"`

## Tech Stack

| Component           | Technology     |
| ------------------- | -------------- |
| Runtime             | Bun            |
| Language            | TypeScript     |
| CLI Framework       | Commander.js   |
| Interactive Prompts | @clack/prompts |
| Terminal Colors     | picocolors     |
| Template Fetching   | giget          |
| Module System       | ES modules     |
