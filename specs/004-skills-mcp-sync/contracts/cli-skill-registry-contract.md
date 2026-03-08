# Contract: CLI Skill Registry Management

## Purpose

Defines the command contract for discovering, activating, updating, deactivating, and synchronizing SkillsMP-backed skills through the `skill` command group.

## Command Surface

```bash
agent-ctrl skill ls [path] [--json]
agent-ctrl skill search <query> [options]
agent-ctrl skill add skillsmp:<id> [options]
agent-ctrl skill update <id> [options]
agent-ctrl skill update --all [options]
agent-ctrl skill rm <id> [options]
agent-ctrl skill sync [options]
```

## Behavioral Guarantees

- `skill ls` MUST continue to list locally managed skills by default.
- `skill search` MUST search the synchronized SkillsMP catalog and return cached results unless refresh is explicitly requested or cache freshness has expired.
- `skill add skillsmp:<id>` MUST activate the selected compatible skill, create or update the local managed skill artifact, and persist source-tracking metadata. If the item is not already in cache, the command MAY retrieve its installation metadata from the source search result or skill detail/download page during the operation.
- `skill update <id>` MUST update the selected managed skill only when a newer compatible source version is available.
- `skill update --all` MUST evaluate all active managed skills and update only the ones with compatible available updates.
- `skill rm <id>` MUST deactivate the managed skill locally while preserving historical source metadata.
- `skill sync` MUST refresh the local SkillsMP catalog cache for tracked discovery scopes and report added, updated, unchanged, skipped, and failed results. It MUST NOT claim exhaustive full-catalog sync unless SkillsMP exposes a documented authoritative listing surface.

## Input Rules

| Command        | Required Input    | Validation                                                                                                                                               |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skill search` | `query`           | Query MUST be non-empty                                                                                                                                  |
| `skill add`    | `skillsmp:<id>`   | Source prefix MUST be `skillsmp:` and target item MUST exist in the known catalog or be retrievable during the operation                                 |
| `skill update` | `<id>` or `--all` | Exactly one of item selection or `--all` MUST be provided                                                                                                |
| `skill rm`     | `<id>`            | Item MUST identify an active or previously managed skill                                                                                                 |
| `skill sync`   | none              | Optional filters MAY define or refresh discovery scopes such as query or category slices; default behavior MUST refresh tracked scopes and managed items |

## Options

| Option                 | Applies To                       | Description                                                                           |
| ---------------------- | -------------------------------- | ------------------------------------------------------------------------------------- |
| `--json`               | `ls`, `search`, `sync`, `update` | Return structured output for automation                                               |
| `--refresh`            | `search`, `add`, `update`        | Force a source refresh before evaluating the request                                  |
| `--capability <value>` | `search`                         | Filter results by declared capability                                                 |
| `--status <value>`     | `search`, `ls`                   | Filter results by activation/update/compatibility state                               |
| `--version <value>`    | `add`                            | Request a specific source version when supported by the source                        |
| `--query <value>`      | `sync`                           | Refresh or seed a query-based discovery scope                                         |
| `--category <value>`   | `sync`                           | Refresh or seed a category-based discovery scope when supported by the source surface |
| `--ai`                 | `search`, `sync`                 | Use the source’s semantic-search surface when supported                               |

## Output Guarantees

- All commands MUST produce a clear completion summary.
- Search results MUST expose description, capabilities, version, source identifier, compatibility state, and whether data came from cache or fresh sync.
- Activation, update, removal, and sync outputs MUST distinguish `success`, `unchanged`, `skipped`, and `failed` item outcomes.
- Sync output MUST identify which discovery scopes were refreshed and whether results represent tracked scopes rather than an authoritative global inventory.
- Errors MUST be actionable and MUST NOT reveal credential values.

## Exit Semantics

- Exit code `0`: operation completed successfully or partially successfully with actionable per-item results.
- Non-zero exit code: the requested operation could not complete for any target because of invalid input, inaccessible state, or unrecoverable source failure.

## Compatibility and Safety Rules

- Incompatible skills MUST NOT be activated or updated.
- Unknown compatibility MAY be shown in search results but MUST require explicit operator confirmation semantics before activation is attempted.
- Existing unrelated skill directories MUST NOT be modified by source-managed activation/update operations.
