# Data Model: Dynamic MCP Config Management

## Entity: MCPConfigFile

- Description: A discovered MCP JSON file from `MCPs/`.
- Fields:
- `fileName` (string)
- `absolutePath` (string)
- `mcpServers` (map<string, MCPServerEntry>)
- `status` (enum): `discovered | validated | rejected | loaded`
- Validation rules:
- File MUST be readable JSON.
- Top-level `mcpServers` MUST exist and be an object.
- `mcpServers` MUST contain at least one server entry.

## Entity: MCPServerEntry

- Description: A single server definition under `mcpServers`.
- Fields:
- `serverId` (string)
- `command` (string)
- `args` (string[])
- `env` (map<string, string>, optional)
- `cwd` (string, optional)
- `resolvedEnv` (map<string, string>): Final runtime env passed to server.
- Validation rules:
- `command` MUST be non-empty.
- `args` MUST be an array.
- `env` values MUST be strings if present.
- Duplicate `serverId` values across files MUST be marked as conflict errors.

## Entity: MCPEnvFile

- Description: Environment source loaded from `MCPs/.env`.
- Fields:
- `path` (string): `MCPs/.env`
- `variables` (map<string, string>)
- `readStatus` (enum): `loaded | missing | unreadable | malformed`

## Entity: InterpolationReference

- Description: A placeholder token `${VAR}` found in any JSON string.
- Fields:
- `token` (string): Full placeholder, e.g. `${API_TOKEN}`
- `variableName` (string): e.g. `API_TOKEN`
- `filePath` (string)
- `serverId` (string)
- `jsonPath` (string): Location of the string field containing token.
- `resolutionStatus` (enum): `resolved | unresolved`

## Entity: ValidationIssue

- Description: Actionable issue produced during validation or interpolation.
- Fields:
- `severity` (enum): `warning | error`
- `code` (string)
- `message` (string)
- `filePath` (string)
- `serverId` (string, optional)

## Entity: ServerConflictIssue

- Description: Conflict record for duplicate `mcpServers` keys discovered across files.
- Fields:
- `serverId` (string)
- `firstFilePath` (string)
- `secondFilePath` (string)
- `resolution` (enum): `reject-all-impacted`

## Entity: MCPLoadReport

- Description: Per-run summary for operator visibility.
- Fields:
- `startedAt` (datetime string)
- `finishedAt` (datetime string)
- `totalDiscovered` (number)
- `totalLoaded` (number)
- `totalSkipped` (number)
- `totalFailed` (number)
- `fileResults` (array of MCPFileResult)

## Entity: MCPFileResult

- Description: Per-file result in `MCPLoadReport`.
- Fields:
- `filePath` (string)
- `status` (enum): `loaded | skipped | failed`
- `loadedServerCount` (number)
- `failedServerCount` (number)
- `issues` (ValidationIssue[])

## Relationships

- One `MCPConfigFile` contains many `MCPServerEntry` records.
- One `MCPConfigFile` can produce many `ValidationIssue` records.
- One `MCPConfigFile` can produce `ServerConflictIssue` records when duplicate keys are detected.
- One `MCPServerEntry` can produce many `InterpolationReference` records.
- One `MCPLoadReport` contains many `MCPFileResult` records.

## State Transitions

- `MCPConfigFile.status`:
- `discovered -> validated -> loaded`
- `discovered -> rejected`
- `validated -> rejected`
- `InterpolationReference.resolutionStatus`:
- `unresolved -> resolved`
