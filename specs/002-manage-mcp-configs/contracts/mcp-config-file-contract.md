# Contract: MCP Configuration File

## Purpose

Defines the JSON contract for files placed in the `MCPs` directory.

## File Discovery Contract

- Directory: `<agent-ctrl-config-dir>/MCPs`
- Supported extension: `.json`
- `.env` source location: `<agent-ctrl-config-dir>/MCPs/.env`
- Processing order: lexical by relative path

## Required Document Fields

- `mcpServers` (object): Top-level map of server IDs to server definitions.
- `mcpServers.<serverId>.command` (string): Executable command for server startup.
- `mcpServers.<serverId>.args` (string[]): Command arguments.

## Optional Document Fields

- `mcpServers.<serverId>.env` (object<string, string>): Server env values or `${VAR}` placeholders.
- `mcpServers.<serverId>.cwd` (string): Working directory.
- Additional server properties are allowed if they are valid JSON values.

## Variable Resolution Contract

- Agent-ctrl MUST load key/value pairs from `MCPs/.env`.
- Any `${VAR}` placeholder in any string value in the JSON MUST be resolved from `MCPs/.env`.
- Unresolved placeholders MUST fail validation for the impacted server entry.
- Runtime server `env` MUST include resolved values from:
- `MCPs/.env` variables.
- `mcpServers.<serverId>.env` entries (after placeholder resolution).
- On key collision, `mcpServers.<serverId>.env` values MUST override `MCPs/.env` values.

## Validation Contract

- Missing required fields (including missing `mcpServers`): `failed` status, no load.
- Missing/invalid `command` or `args`: `failed` status, no load.
- Malformed JSON: `failed` status, no load.
- Missing/malformed `MCPs/.env`: `failed` status for entries requiring interpolation/env injection.
- Unresolved `${VAR}` placeholder: `failed` status for impacted entry.
- Duplicate `mcpServers` key across files: `failed` status for all impacted entries; no silent override.

## Missing `.env` Behavior

- If no `${VAR}` placeholder exists and no server `env` requires external resolution, missing `MCPs/.env` is allowed with warning.
- If `${VAR}` placeholders exist or resolution is required, missing/malformed `MCPs/.env` MUST fail impacted entries.

## Security Contract

- Secret values resolved from `.env` MUST NOT appear in logs.
- Error messages MAY name missing variable keys but MUST NOT print secret values.

## Example (Informative)

`<agent-ctrl-config-dir>/MCPs/bright-data.json`

```json
{
  "mcpServers": {
    "Bright Data": {
      "command": "npx",
      "args": ["@brightdata/mcp"],
      "env": {
        "API_TOKEN": "${API_TOKEN}"
      }
    }
  }
}
```

`<agent-ctrl-config-dir>/MCPs/.env`

```dotenv
API_TOKEN=your-api-token-here
```
