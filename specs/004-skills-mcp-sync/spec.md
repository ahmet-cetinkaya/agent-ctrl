# Feature Specification: Skills and MCP Sync

**Feature Branch**: `004-skills-mcp-sync`  
**Created**: 2026-03-08  
**Status**: Draft  
**Input**: User description: "Integrate external skill and MCP catalogs into agent-ctrl with synchronized discovery, search, filtering, activation controls, update handling, caching, authentication support, quota-aware refresh behavior, and compatibility checks."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Discover and Inspect Available Integrations (Priority: P1)

As an operator, I can retrieve the latest discoverable skills and MCPs from the supported source catalogs, search and filter them through the existing `skill` and `mcp` catalog flows, and inspect each item’s description, capabilities, source, and compatibility status before I decide what to enable.

**Why this priority**: Discovery is the core value of this feature. Without a trusted, searchable catalog view, operators cannot safely choose or manage integrations.

**Independent Test**: Can be fully tested by synchronizing the source catalogs, listing the available items, applying search and filter criteria, and confirming that each result exposes enough detail to make an activation decision.

**Acceptance Scenarios**:

1. **Given** the operator has access to both supported source catalogs, **When** they run a catalog sync, **Then** the system registers discoverable skills from configured SkillsMP discovery scopes and discoverable MCPs from Smithery and makes them available for listing and filtering.
2. **Given** the catalog contains multiple skills and MCPs, **When** the operator searches by keyword or filters by capability, category, status, or compatibility, **Then** the system returns only the matching items within the relevant catalog view.
3. **Given** an item appears in the catalog, **When** the operator inspects it through search or list output, **Then** the system displays its description, declared capabilities, source identifier, current version, and compatibility status.

---

### User Story 2 - Activate and Deactivate Individual Integrations (Priority: P2)

As an operator, I can activate or deactivate an individual skill or MCP without affecting unrelated entries, so I can tailor the active integration set for my project and reverse changes safely.

**Why this priority**: Management of individual entries is the main operational workflow after discovery and is required for real project use.

**Independent Test**: Can be tested by activating one catalog item, confirming it becomes active and tracked, deactivating it, and confirming the inactive state is preserved without removing its catalog metadata.

**Acceptance Scenarios**:

1. **Given** a compatible skill or MCP is available in the synchronized catalog, **When** the operator activates that item, **Then** the system marks it active, registers it for ongoing update checks, and leaves unrelated items unchanged.
2. **Given** an item is already active, **When** the operator deactivates it, **Then** the system marks it inactive while preserving its source metadata and management history.
3. **Given** an item is known to be incompatible with the current environment or required integration model, **When** the operator attempts to activate or update it, **Then** the system blocks the change and explains the incompatibility.

---

### User Story 3 - Keep Catalog and Active Integrations Current (Priority: P3)

As an operator, I can refresh catalog data, detect newly added or updated source items, and keep active skills and MCPs synchronized with their source platforms while receiving clear feedback about authentication issues, source throttling, partial failures, and cached results.

**Why this priority**: Ongoing synchronization is necessary to keep the tool useful over time, but it depends on the discovery and item-management flows above.

**Independent Test**: Can be tested by running a refresh after catalog data exists, observing update detection and status reporting, and confirming the system continues to provide usable results when one source is temporarily unavailable or rate-limited.

**Acceptance Scenarios**:

1. **Given** synchronized catalog data already exists, **When** the operator requests a manual refresh, **Then** the system fetches fresh source data, updates its local registry view, and reports added, updated, unchanged, unavailable, and failed items.
2. **Given** the operator performs repeated browse or search actions without requesting a refresh and cached data is still fresh, **When** the catalog is queried again, **Then** the system serves the cached data and indicates when it was last synchronized.
3. **Given** one source platform is unavailable, rate-limited, or requires renewed authentication, **When** the operator runs a refresh or update action, **Then** the system preserves usable data from the other source, records the failure, and returns an actionable partial-result summary.

### Edge Cases

- One source catalog is reachable while the other is unavailable during the same sync run.
- A source returns duplicate, renamed, or removed entries between sync runs.
- Required credentials are missing, expired, or insufficient for one source but valid for the other.
- A catalog item is visible but lacks description, declared capabilities, or compatibility metadata.
- A source quota or throttle limit is reached in the middle of a refresh.
- An operator requests activation for an item that has been removed or marked unavailable since the last successful sync.
- An active item becomes incompatible after the tool version, source version, or required capabilities change.
- A manual refresh is requested while a previous sync is already in progress.
- Cached data exists but is stale and the source cannot currently be reached.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST retrieve discoverable skills from configured SkillsMP discovery scopes and discoverable MCPs from Smithery and register them in a unified local catalog state.
- **FR-002**: System MUST maintain catalog metadata for each discovered item, including item type, source, source identifier, display name, description, declared capabilities, version information, compatibility status, activation state, and synchronization timestamps.
- **FR-003**: System MUST allow operators to list discovered skills and MCPs through the existing `skill` and `mcp` catalog command groups, while preserving a unified local catalog state behind those views.
- **FR-004**: System MUST allow operators to search discovered integrations by keyword across names, descriptions, identifiers, and declared capabilities.
- **FR-005**: System MUST allow operators to filter discovered integrations by activation state, compatibility state, update availability, declared capability, and any source-provided categorization metadata that is available for the item.
- **FR-006**: System MUST expose an item’s description, declared capabilities, source, current version, and compatibility status through expanded search or list output before activation or update is performed.
- **FR-007**: System MUST allow an operator to activate an individual compatible skill or MCP from the discovered catalog.
- **FR-008**: System MUST allow an operator to deactivate an individual active skill or MCP without deleting its catalog record or source-tracking metadata.
- **FR-009**: System MUST prevent duplicate registration or duplicate activation records for the same source item.
- **FR-010**: System MUST track which active items originated from SkillsMP and which originated from Smithery so they can be updated or deactivated individually.
- **FR-011**: System MUST detect when a discovered or active item has a newer available source version and expose that update status to the operator.
- **FR-012**: System MUST allow operators to update one selected active item or all active items with available updates.
- **FR-013**: System MUST support a manual refresh action for either supported source and MUST allow operators to refresh both sources by invoking the corresponding source sync commands.
- **FR-014**: System MUST cache synchronized catalog data and reuse that cache for browse and search operations until the cache is stale or a manual refresh is requested.
- **FR-015**: System MUST indicate whether displayed catalog results are based on cached data or the latest completed synchronization and MUST show the last successful synchronization time for each source.
- **FR-016**: System MUST support source authentication when required and MUST provide actionable guidance when credentials are missing, expired, or rejected.
- **FR-017**: System MUST handle rate limits and quota restrictions without corrupting catalog state, and MUST explain whether the action was delayed, partially completed, or stopped.
- **FR-018**: System MUST continue processing unaffected sources or unaffected items when a refresh or update encounters a failure that does not invalidate the rest of the operation.
- **FR-019**: System MUST record failed fetch, refresh, activation, deactivation, and update attempts with enough detail for an operator to identify the affected source or item, the failure reason, and the time of failure.
- **FR-020**: System MUST preserve the activation state of existing items across catalog refreshes unless the operator explicitly changes that state.
- **FR-021**: System MUST mark items that are no longer available from their source as unavailable and MUST prevent new activation of those unavailable items.
- **FR-022**: System MUST retain the management record for active or previously active items even if the source no longer lists them, so operators can review their status and take explicit action.
- **FR-023**: System MUST evaluate version compatibility before activation or update and MUST prevent changes when compatibility requirements are not met.
- **FR-024**: System MUST expose compatibility outcomes in a way that lets operators distinguish between compatible, incompatible, and unknown compatibility states.
- **FR-025**: System MUST provide a clear completion summary after each sync, refresh, activation, deactivation, or update action, including counts of changed, unchanged, unavailable, skipped, and failed items as applicable.

### Key Entities _(include if feature involves data)_

- **Catalog Item**: A discovered skill or MCP that can be searched, filtered, inspected, activated, updated, deactivated, or marked unavailable.
- **Source Registry**: One of the supported upstream catalogs, including its access status, authentication state, synchronization timestamps, and refresh outcome history.
- **Managed Integration**: A catalog item that has been activated for local use and is tracked for future updates, compatibility checks, and lifecycle changes.
- **Compatibility Status**: The recorded evaluation of whether a catalog item can be safely activated or updated in the current environment.
- **Sync Result**: The outcome of a discovery, refresh, or update operation, including per-source and per-item statuses, timestamps, and actionable failure details.

### Assumptions

- SkillsMP exposes searchable discovery surfaces rather than a documented exhaustive catalog listing, so SkillsMP synchronization is scope-based while Smithery synchronization can traverse its documented registry surface.
- Operators using this feature have permission to store local catalog state and to activate or deactivate integrations for their project environment.
- Compatibility can be determined from source-provided metadata, tool-maintained compatibility rules, or both.
- Deactivation affects local managed state only and does not modify the upstream source platforms.

### Dependencies

- Continued access to the SkillsMP and Smithery catalogs, including any credentials required by those sources.
- A persistent local storage location for discovered items, activation state, synchronization history, and failure records.
- Existing agent-ctrl management workflows are capable of representing active skills and MCPs as locally managed artifacts once selected.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In at least 95% of observed operator sessions, a user can find and inspect a desired skill or MCP from the synchronized catalog in under 2 minutes.
- **SC-002**: In at least 95% of refresh runs where the source platforms are reachable and authorized, the system completes synchronization and returns a source-by-source status summary in under 60 seconds.
- **SC-003**: 100% of activation, deactivation, and update attempts result in either a confirmed state change or an actionable explanation of why the requested action could not be completed.
- **SC-004**: 100% of known incompatible items are identified before activation or update changes are applied.
- **SC-005**: Repeated catalog list or search operations performed within the freshness window trigger no new source requests unless the operator explicitly requests a manual refresh.
- **SC-006**: In 100% of partial-failure sync runs, the operator can distinguish which source or items succeeded, failed, were skipped, or are still using cached data.
