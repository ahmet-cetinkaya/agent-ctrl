# Research: Skills and MCP Sync

## Scope

Feature context: add remote-catalog synchronization, search, activation, update, deactivation, caching, compatibility checks, and partial-failure handling for SkillsMP skills and Smithery MCPs within the existing `skill` and `mcp` CLI feature sets.

## Decision 1: Command Surface Strategy

- Decision: Extend the existing `skill` and `mcp` command groups with source-aware `search`, `add`, `update`, `rm`, and `sync` workflows while preserving current `ls` behavior for local managed artifacts.
- Rationale: The repository already models artifact management as grouped CLI subcommands, Commander.js supports this nested shape well, and this approach preserves operator expectations and backward compatibility with current docs and tests.
- Alternatives considered:
- Introduce a new top-level `registry` command. Rejected because it duplicates the current artifact-centric CLI shape and forces operators to learn a second interaction model.
- Replace `skill ls` and `mcp ls` with remote catalog output by default. Rejected because it would break current local-list semantics and existing contract coverage.

## Decision 2: Catalog Cache and Sync-State Persistence

- Decision: Persist synchronized source snapshots and operation state in a hidden catalog directory inside the config root, separate from `skills/` and `mcps/`.
- Rationale: Cached catalog data, refresh timestamps, and failure history are operational metadata rather than user-authored artifacts and should not pollute directories that are already scanned as active content.
- Alternatives considered:
- Store all catalog metadata inside each managed skill or MCP artifact directory. Rejected because it fragments sync state, makes global refresh harder, and complicates deactivated-item tracking.
- Keep catalog state only in memory. Rejected because caching, offline fallback, and update detection require durable state across CLI invocations.

## Decision 3: SkillsMP Discovery and Install Strategy

- Decision: Use the documented SkillsMP REST API for keyword and AI search discovery, but treat installation as a separate page/download workflow because the public API docs currently document search endpoints, authentication, and quota headers without documenting a bulk-list or install/download endpoint.
- Rationale: Current SkillsMP docs show authenticated `GET /api/v1/skills/search` and `GET /api/v1/skills/ai-search`, a 500 requests/day quota, and no wildcard search support. The site’s skill pages expose repository metadata and downloadable bundles, which is enough to plan a best-effort installation workflow, but not enough to assume an authoritative bulk export API.
- Alternatives considered:
- Assume SkillsMP supports full-catalog sync through a hidden or undocumented endpoint. Rejected because the current docs do not substantiate that assumption.
- Scrape the entire public site as the primary sync mechanism. Rejected for the initial plan because it is less stable than the documented API and interacts badly with the published daily quota.

## Decision 4: Managed Source Tracking

- Decision: Maintain explicit managed-integration records that map a local skill directory or MCP config file to its upstream source identifier, installed version, activation state, and update history.
- Rationale: Filesystem scanning alone can identify active local artifacts but cannot reliably answer which source/version produced them or whether an update is available.
- Alternatives considered:
- Infer source/version from artifact names only. Rejected because names are not stable enough to support version-aware updates or deactivated-history retention.
- Track source metadata only in command output. Rejected because lifecycle operations need persistent state.

## Decision 5: Smithery Discovery Strategy

- Decision: Use Smithery’s documented authenticated registry flow as the authoritative MCP discovery surface: paginated `GET /servers` for browsing/search and `GET /servers/{id}` for server details, connections, tool metadata, and configuration schema.
- Rationale: Smithery documents authenticated pagination, search filters, server detail retrieval, and per-server connection/config-schema metadata, which fits the MCP lifecycle requirements directly.
- Alternatives considered:
- Model Smithery MCP discovery as HTML scraping only. Rejected because the registry API and docs are already documented and more stable for planning.
- Introduce the Smithery SDK as a mandatory first-step dependency. Rejected for the initial plan because direct HTTP access matches current repository patterns and avoids adding a dependency before the integration behavior is proven.

## Decision 6: Authentication and Rate-Limit Handling

- Decision: Resolve source credentials at execution time from configured inputs, persist only sanitized auth-status metadata, and use quota-aware retry/backoff behavior that can return partial-success summaries instead of failing the entire operation.
- Rationale: SkillsMP publishes a 500 requests/day quota with rate-limit headers, and Smithery requires bearer authentication for registry access. The constitution also forbids exposing secrets.
- Alternatives considered:
- Persist raw tokens in the catalog cache. Rejected because it violates secret-handling requirements.
- Fail the full sync as soon as one source returns authentication or quota errors. Rejected because the feature explicitly requires unaffected sources to continue when safe.

## Decision 7: MCP Activation Representation

- Decision: Materialize Smithery-provided MCP activations as managed files in `mcps/` that remain compatible with the existing MCP loader and `mcp ls` flow, with source metadata stored in the hidden catalog state.
- Rationale: The repository already has a working MCP filesystem loader/reporting path. Reusing that path avoids inventing a second runtime format for active MCP entries.
- Alternatives considered:
- Keep MCP activations only in remote-cache metadata and inject them dynamically at runtime. Rejected because it bypasses the current `mcps/` discovery path and weakens deterministic local state.
- Replace the existing MCP loader with a registry-only model. Rejected because it would expand scope far beyond this feature.

## Decision 8: Compatibility Evaluation Policy

- Decision: Compute compatibility as a first-class lifecycle check with three explicit outcomes: `compatible`, `incompatible`, and `unknown`, using source metadata plus tool-maintained rules before activation or update.
- Rationale: The spec requires operators to see compatibility before lifecycle changes and to block incompatible changes while still surfacing items whose compatibility cannot yet be determined.
- Alternatives considered:
- Treat missing compatibility metadata as compatible. Rejected because it can introduce unsafe activations.
- Hide items with unknown compatibility. Rejected because discovery should still expose them for operator review.

## Decision 9: Reporting and Logging Model

- Decision: Reuse the repository’s summary-oriented CLI pattern by returning per-operation reports with counts, per-item outcomes, and sanitized issue messages, plus structured JSON output for automation.
- Rationale: Existing CLI commands already separate user-facing summaries from structured result data, and the constitution requires actionable diagnostics with machine-readable support where feasible.
- Alternatives considered:
- Emit only human-readable logs. Rejected because automation and contract testing benefit from stable structured output.
- Emit only per-item output with no aggregate summary. Rejected because operators need fast diagnosis across large sync/update runs.

## External Evidence Summary

- SkillsMP public API docs currently document authenticated search endpoints, daily quota headers, and no wildcard support.
- SkillsMP skill pages expose repository metadata and downloadable skill bundles in the UI, which supports planning a page/download-backed install path.
- Smithery public docs currently document authenticated paginated registry access, server detail retrieval, and configuration-schema metadata for MCP servers.
- Commander.js docs support the nested command-group structure already used by this repository.
