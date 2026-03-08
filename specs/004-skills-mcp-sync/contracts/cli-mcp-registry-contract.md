# Contract: CLI MCP Registry Management

## Purpose

Defines the command contract for discovering, activating, updating, deactivating, and synchronizing Smithery-backed MCPs through the `mcp` command group.

## Command Surface

```bash
agent-ctrl mcp ls [path] [--json]
agent-ctrl mcp search <query> [options]
agent-ctrl mcp add smithery:<id> [options]
agent-ctrl mcp update <id> [options]
agent-ctrl mcp update --all [options]
agent-ctrl mcp rm <id> [options]
agent-ctrl mcp sync [options]
```

## Behavioral Guarantees

- `mcp ls` MUST continue to enumerate locally managed MCP configurations and surface configuration issues.
- `mcp search` MUST search the synchronized Smithery catalog and return cached results unless refresh is explicitly requested or cache freshness has expired.
- `mcp add smithery:<id>` MUST activate the selected compatible MCP by materializing a managed MCP configuration that remains readable by the existing MCP loader flow and MUST use the source server-detail metadata needed to resolve connection/configuration requirements.
- `mcp update <id>` MUST update the selected managed MCP only when a newer compatible source version is available.
- `mcp update --all` MUST evaluate all active managed MCPs and update only the ones with compatible available updates.
- `mcp rm <id>` MUST deactivate the managed MCP locally while preserving historical source metadata.
- `mcp sync` MUST refresh the local Smithery catalog cache using the documented paginated server-registry surface and report added, updated, unchanged, skipped, and failed results.

## Input Rules

| Command      | Required Input    | Validation                                                                                                               |
| ------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mcp search` | `query`           | Query MUST be non-empty                                                                                                  |
| `mcp add`    | `smithery:<id>`   | Source prefix MUST be `smithery:` and target item MUST exist in the known catalog or be retrievable during the operation |
| `mcp update` | `<id>` or `--all` | Exactly one of item selection or `--all` MUST be provided                                                                |
| `mcp rm`     | `<id>`            | Item MUST identify an active or previously managed MCP                                                                   |
| `mcp sync`   | none              | Optional filters MAY narrow scope but MUST NOT change default full-source sync semantics                                 |

## Options

| Option                 | Applies To                       | Description                                                       |
| ---------------------- | -------------------------------- | ----------------------------------------------------------------- |
| `--json`               | `ls`, `search`, `sync`, `update` | Return structured output for automation                           |
| `--refresh`            | `search`, `add`, `update`        | Force a source refresh before evaluating the request              |
| `--capability <value>` | `search`                         | Filter results by declared capability                             |
| `--status <value>`     | `search`, `ls`                   | Filter results by activation/update/compatibility state           |
| `--version <value>`    | `add`                            | Request a specific source version when supported by the source    |
| `--page-size <value>`  | `sync`, `search`                 | Tune paginated registry traversal within documented source limits |

## Output Guarantees

- All commands MUST produce a clear completion summary.
- Search results MUST expose description, capabilities, version, source identifier, compatibility state, and whether data came from cache or fresh sync.
- Search and add flows MUST surface the server’s connection/configuration requirements when the source provides them.
- Activation, update, removal, and sync outputs MUST distinguish `success`, `unchanged`, `skipped`, and `failed` item outcomes.
- `mcp ls --json` MUST continue to redact sensitive environment values in rendered output.
- Errors MUST be actionable and MUST NOT reveal credential values.

## Exit Semantics

- Exit code `0`: operation completed successfully or partially successfully with actionable per-item results.
- Non-zero exit code: the requested operation could not complete for any target because of invalid input, inaccessible state, or unrecoverable source failure.

## Compatibility and Safety Rules

- Incompatible MCPs MUST NOT be activated or updated.
- Managed MCP activation MUST preserve compatibility with the existing MCP file-discovery and reporting path.
- Existing unrelated MCP configuration files MUST NOT be modified by source-managed activation/update operations unless they are the managed target for the requested item.
