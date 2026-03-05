# Feature Specification: Dynamic MCP Config Management

**Feature Branch**: `[002-manage-mcp-configs]`  
**Created**: 2026-03-05  
**Status**: Draft  
**Input**: User description: "agent-ctrl should dynamically manage MCP MCP configurations for multiple platforms by scanning and loading all MCP configurations from a dedicated MCPs folder located within the agent-ctrl configuration directory. agent-ctrl should automatically detect and parse each MCP configuration file and apply the appropriate MCP settings to their corresponding target platforms based on platform identifiers or metadata within the configuration. agent-ctrl MCP configuration system should support .env file references for handling sensitive credentials and API keys, allowing MCPs to reference environment variables from .env files while maintaining security and keeping sensitive data out of version control. agent-ctrl should handle MCP configuration validation, error handling for missing or invalid configurations, and provide clear logging for configuration loading and application processes."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Load MCP Servers Automatically (Priority: P1)

As an operator, I want agent-ctrl to automatically discover MCP JSON files from a dedicated `MCPs` folder so that all configured `mcpServers` are loaded without manual file registration.

**Why this priority**: Core value depends on automatic discovery and loading.

**Independent Test**: Can be fully tested by placing multiple valid MCP JSON files in `MCPs/` and confirming all `mcpServers` entries are loaded in one apply run.

**Acceptance Scenarios**:

1. **Given** the `MCPs` folder contains valid MCP JSON files with `mcpServers`, **When** agent-ctrl runs apply, **Then** all discovered server entries are loaded.
2. **Given** a new valid MCP JSON file is added to `MCPs/`, **When** agent-ctrl runs the next apply, **Then** the new server entries are discovered and loaded.

---

### User Story 2 - Resolve Variables From MCPs/.env (Priority: P2)

As an operator, I want variables from `MCPs/.env` to be used for MCP configuration values so I can keep secrets out of JSON files.

**Why this priority**: Secret handling and variable substitution are required for real MCP usage.

**Independent Test**: Can be fully tested by creating `MCPs/.env`, using `${VAR}` placeholders in JSON values, and confirming apply resolves and passes values into server `env` without exposing secrets in logs.

**Acceptance Scenarios**:

1. **Given** `MCPs/.env` defines `API_TOKEN` and an MCP JSON uses `${API_TOKEN}` in a string value, **When** apply runs, **Then** the placeholder is resolved from `MCPs/.env`.
2. **Given** `MCPs/.env` exists and server entries include an `env` object, **When** apply runs, **Then** `.env` variables and resolved server `env` values are passed into each loaded server entry, with server `env` keys taking precedence on key collisions.

---

### User Story 3 - Fail Invalid Files, Keep Valid Files (Priority: P3)

As an operator, I want invalid MCP files to be reported clearly while valid files still load so one bad file does not block all MCPs.

**Why this priority**: Reliability requires partial-failure handling and actionable diagnostics.

**Independent Test**: Can be fully tested with one malformed JSON plus one valid JSON in `MCPs/` and confirming valid servers still load while malformed file is reported.

**Acceptance Scenarios**:

1. **Given** one malformed MCP JSON file, **When** apply runs, **Then** the file is marked failed with file-specific reason.
2. **Given** both valid and invalid MCP files, **When** apply runs, **Then** valid servers are loaded and invalid files are skipped with clear error messages.
3. **Given** two files define the same `mcpServers` key, **When** apply runs, **Then** both impacted entries are reported as conflicts and are not silently overridden.

### Edge Cases

- What happens when `MCPs/` exists but contains no JSON files?
- What happens when two files define the same `mcpServers` key?
- What happens when `MCPs/.env` is missing, unreadable, or malformed?
- How are unresolved `${VAR}` placeholders handled when used in any string value?
- How are non-string `env` values handled in server entries?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST scan the dedicated `MCPs` folder within the agent-ctrl configuration directory and discover all supported MCP JSON files during each apply/load cycle.
- **FR-002**: System MUST parse discovered MCP files using the standard JSON `mcpServers` object structure.
- **FR-003**: System MUST load all valid `mcpServers` entries discovered in `MCPs/` for the apply operation.
- **FR-004**: System MUST process multiple MCP JSON files in deterministic order.
- **FR-005**: System MUST read environment variables from a `.env` file located at `MCPs/.env`.
- **FR-006**: System MUST resolve `${VAR}` placeholders appearing in any string value in MCP JSON content using values from `MCPs/.env`.
- **FR-007**: System MUST pass resolved environment variables into each loaded server entry's `env` configuration, where server entry `env` values override same-name keys from `MCPs/.env`.
- **FR-008**: System MUST validate each server entry includes required `command` (string) and `args` (array) fields.
- **FR-009**: System MUST treat duplicate `mcpServers` keys across different files as a validation error and skip the impacted entries (no silent override).
- **FR-010**: System MUST reject and skip invalid files or server entries and continue processing remaining valid files.
- **FR-011**: System MUST produce clear logs for file discovery, validation results, load success/failure, and skip reasons.
- **FR-012**: System MUST redact or avoid printing secret values in logs and error output.
- **FR-013**: System MUST surface actionable errors for missing files, invalid JSON, missing `command`/`args`, malformed `.env`, and unresolved placeholders.
- **FR-014**: System MUST allow apply to proceed without `MCPs/.env` only when no `${VAR}` placeholders are used and no server `env` key requires external resolution; otherwise it MUST fail impacted entries with actionable errors.

### Key Entities _(include if feature involves data)_

- **MCP Configuration File**: A JSON file in `MCPs/` containing one `mcpServers` object.
- **MCP Server Entry**: A single server definition under `mcpServers` with `command`, `args`, and optional `env`.
- **MCP Env Source**: The `.env` file located at `MCPs/.env` used for variable resolution.
- **Interpolation Reference**: A `${VAR}` placeholder found in any string value in MCP JSON content.
- **Configuration Load Result**: Per-run summary of discovered files, loaded entries, skipped entries, and failure reasons.

### Assumptions

- The agent-ctrl configuration directory path is already established by existing product behavior.
- MCP config files use JSON with top-level `mcpServers`.
- `.env` for MCP resolution is always expected at `MCPs/.env`.
- Operators have filesystem permissions to read `MCPs/` and `MCPs/.env`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In a test set of at least 50 valid MCP JSON files, 100% of valid `mcpServers` entries are discovered and loaded.
- **SC-002**: In mixed-validity runs, 100% of invalid files are rejected with file-specific actionable errors while 100% of valid files still load.
- **SC-003**: 95% of load runs for up to 100 MCP files complete within 10 seconds.
- **SC-004**: 100% of `${VAR}` placeholders in string values are resolved from `MCPs/.env` or reported as unresolved errors.
- **SC-005**: 100% of security review checks confirm that raw secret values are never printed in logs or error output.
