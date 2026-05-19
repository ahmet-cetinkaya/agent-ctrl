# Data Model: Apply Project Profiles

## Entities

### Profile

A named collection of agent configuration artifacts stored under `.agent-ctrl/profiles/<name>/`.

**Fields**:

- `name` (string): Profile directory name (e.g., "debug", "production")
- `path` (string): Absolute path to profile directory
- `configRoot` (string): Absolute path to `.agent-ctrl/` parent directory
- `artifactPaths` (object): Resolved paths for each artifact type within the profile
  - `rules` (string | null): Path to `rules/` subdirectory or null if absent
  - `skills` (string | null): Path to `skills/` subdirectory or null if absent
  - `agents` (string | null): Path to `agents/` subdirectory or null if absent
  - `commands` (string | null): Path to `commands/` subdirectory or null if absent
  - `mcps` (string | null): Path to `mcps/` subdirectory or null if absent

**Validation rules**:

- `name` must be a non-empty string matching `[a-zA-Z0-9_-]+`
- `path` must resolve to an existing directory
- Profile is scoped to a single project (no global profiles)

**Relationships**:

- Belongs to: Base Configuration (`.agent-ctrl/`)
- Contains: Zero or more of each artifact type (rules, skills, agents, commands, MCPs)

### MergedConfiguration

The result of merging a profile's artifacts with the base configuration.

**Fields**:

- `rules` (Rule[]): Base rules with profile rules overriding same-named files
- `skills` (Skill[]): Base skills with profile skill directories replacing base skill directories of the same ID
- `agents` (Agent[]): Base agents with profile agents overriding same-named files
- `commands` (CommandArtifact[]): Base commands with profile command directories replacing base command directories of the same ID
- `mcpServers` (ApplyMcpServer[]): Base MCP servers with profile MCP settings field-level merged for matching server keys
- `warnings` (string[]): Combined warnings from base and profile loading

**Merge rules**:

- File-based artifacts (rules, agents): Same filename → profile wins
- Directory-based artifacts (skills, commands): Same directory name → entire profile directory replaces base
- MCP configs: Same server key → field-level merge (profile fields override, unspecified fields retained from base)

### ProfileError

Error type for profile-specific failures.

**Fields**:

- `code` (string): Error identifier from `ERROR_IDS`
  - `PROFILE_NOT_FOUND`: Specified profile does not exist
  - `PROFILE_NOT_DIRECTORY`: Profile path exists but is not a directory
- `message` (string): Human-readable error description
- `profileName` (string): Name of the profile that caused the error

## State Transitions

No state transitions. Profiles are static filesystem artifacts.

## Data Flow

```
CLI: apply profile <name> <platform>
  → Resolve config root (.agent-ctrl/)
  → Validate profile exists at profiles/<name>/
  → Load base snapshot (ApplySourceLoader.load(projectPath))
  → Load profile snapshot (ApplySourceLoader.loadProfile(profilePath))
  → Merge snapshots (ProfileMerger.merge(base, profile))
  → Apply merged snapshot via platform adapter
  → Return result with merged artifact counts
```
