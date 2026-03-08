# Data Model: Skills and MCP Sync

## Entity: SourceRegistry

- Description: One upstream source catalog tracked by agent-ctrl.
- Fields:
- `registryId` (enum): `skillsmp | smithery`
- `displayName` (string)
- `authState` (enum): `unknown | not-required | configured | missing | invalid | expired`
- `lastSyncStartedAt` (datetime string, optional)
- `lastSyncSucceededAt` (datetime string, optional)
- `lastSyncStatus` (enum): `idle | success | partial | failed | throttled`
- `throttleUntil` (datetime string, optional)
- `cacheFreshUntil` (datetime string, optional)
- `catalogItemCount` (number)
- Validation rules:
- `registryId` MUST be unique.
- `lastSyncSucceededAt` MUST be later than or equal to `lastSyncStartedAt` when both exist.
- `throttleUntil` MAY exist only when the last sync outcome was throttled or rate-limited.

## Entity: DiscoveryScope

- Description: A persisted discovery window used to cache and refresh a source-specific slice of catalog data.
- Fields:
- `scopeId` (string)
- `registryId` (enum): `skillsmp | smithery`
- `scopeType` (enum): `global | query | category | tracked-items`
- `scopeKey` (string)
- `query` (string, optional)
- `category` (string, optional)
- `lastRefreshedAt` (datetime string, optional)
- Validation rules:
- `scopeId` MUST be unique.
- `query` MUST be present when `scopeType` is `query`.
- `category` MUST be present when `scopeType` is `category`.
- SkillsMP scopes SHOULD primarily use `query`, `category`, or `tracked-items` unless the source later exposes a documented full-catalog surface.

## Entity: CatalogItem

- Description: A discoverable remote skill or MCP entry imported into the local catalog cache.
- Fields:
- `catalogKey` (string): Stable local key derived from source registry plus source item identifier.
- `registryId` (enum): `skillsmp | smithery`
- `itemType` (enum): `skill | mcp`
- `sourceItemId` (string)
- `displayName` (string)
- `description` (string, optional)
- `capabilities` (string[])
- `categories` (string[])
- `sourceVersion` (string, optional)
- `availabilityState` (enum): `available | unavailable | removed`
- `compatibilityState` (enum): `compatible | incompatible | unknown`
- `activationState` (enum): `inactive | active | update-available | activation-blocked`
- `lastSeenAt` (datetime string)
- `removedAt` (datetime string, optional)
- Validation rules:
- `catalogKey` MUST be unique across both registries.
- `itemType` MUST match the source registry’s supported artifact class.
- `removedAt` MUST be present when `availabilityState` is `removed`.

## Entity: ManagedIntegration

- Description: A locally managed skill or MCP that was activated from a catalog item.
- Fields:
- `managedId` (string)
- `catalogKey` (string)
- `itemType` (enum): `skill | mcp`
- `localPath` (string)
- `state` (enum): `active | inactive | update-available | unavailable | failed`
- `installedVersion` (string, optional)
- `requestedVersion` (string, optional)
- `installedAt` (datetime string)
- `updatedAt` (datetime string, optional)
- `deactivatedAt` (datetime string, optional)
- `lastOperationStatus` (enum): `success | unchanged | failed`
- Validation rules:
- `catalogKey` MUST reference an existing or historically known `CatalogItem`.
- `deactivatedAt` MUST exist when `state` is `inactive`.
- `localPath` MUST point to a skill directory for `skill` items and an MCP config file for `mcp` items.

## Entity: CompatibilityAssessment

- Description: The evaluated compatibility result for a catalog item at a point in time.
- Fields:
- `catalogKey` (string)
- `state` (enum): `compatible | incompatible | unknown`
- `checkedAt` (datetime string)
- `reasons` (string[])
- `requiredConstraints` (string[])
- Validation rules:
- `reasons` MUST contain at least one entry when `state` is `incompatible`.
- `checkedAt` MUST be present for every persisted compatibility assessment.

## Entity: RegistrySyncSnapshot

- Description: A persisted cache snapshot for one source registry.
- Fields:
- `registryId` (enum): `skillsmp | smithery`
- `scopeId` (string)
- `capturedAt` (datetime string)
- `expiresAt` (datetime string)
- `items` (CatalogItem[])
- `syncToken` (string, optional)
- `sourceStatus` (enum): `fresh | stale | failed-last-refresh`
- Validation rules:
- `expiresAt` MUST be later than `capturedAt`.
- `items` MUST contain only records for the matching `registryId`.
- `scopeId` MUST reference an existing `DiscoveryScope`.

## Entity: OperationLogEntry

- Description: A sanitized record of a sync, activation, deactivation, or update attempt.
- Fields:
- `operationId` (string)
- `operationType` (enum): `sync | search | activate | deactivate | update`
- `registryId` (enum, optional): `skillsmp | smithery`
- `catalogKey` (string, optional)
- `status` (enum): `success | partial | failed | skipped | throttled`
- `message` (string)
- `occurredAt` (datetime string)
- Validation rules:
- `status` MUST reflect the final operation outcome.
- `message` MUST be sanitized and MUST NOT contain raw credential values.

## Entity: SyncReport

- Description: Aggregate result of a sync or bulk update action.
- Fields:
- `startedAt` (datetime string)
- `finishedAt` (datetime string)
- `requestedRegistries` (string[])
- `requestedScopes` (string[])
- `usedCachedData` (boolean)
- `totals` (object):
- `discovered` (number)
- `added` (number)
- `updated` (number)
- `unchanged` (number)
- `removed` (number)
- `skipped` (number)
- `failed` (number)
- `registryResults` (array of RegistryResult)
- Validation rules:
- `finishedAt` MUST be later than or equal to `startedAt`.
- `registryResults` MUST contain one result for each requested registry that was attempted.

## Entity: RegistryResult

- Description: Per-source outcome inside a `SyncReport`.
- Fields:
- `registryId` (enum): `skillsmp | smithery`
- `status` (enum): `success | partial | failed | throttled | cached`
- `usedCache` (boolean)
- `itemCounts` (object):
- `discovered` (number)
- `changed` (number)
- `failed` (number)
- `skipped` (number)
- `issues` (string[])
- Validation rules:
- `issues` MUST contain at least one entry when `status` is `partial`, `failed`, or `throttled`.

## Relationships

- One `SourceRegistry` has many `CatalogItem` records.
- One `SourceRegistry` has many `DiscoveryScope` records.
- One `SourceRegistry` has many `RegistrySyncSnapshot` records over time.
- One `DiscoveryScope` has many `RegistrySyncSnapshot` records over time.
- One `CatalogItem` can have zero or one active `ManagedIntegration` records at a time.
- One `CatalogItem` can have many historical `CompatibilityAssessment` records.
- One `SyncReport` contains many `RegistryResult` records.
- One `ManagedIntegration` can produce many `OperationLogEntry` records over its lifecycle.

## State Transitions

- `CatalogItem.activationState`:
- `inactive -> active`
- `active -> update-available`
- `active -> activation-blocked`
- `active -> inactive`
- `inactive -> activation-blocked`

- `CatalogItem.availabilityState`:
- `available -> unavailable`
- `available -> removed`
- `unavailable -> available`

- `ManagedIntegration.state`:
- `active -> update-available`
- `active -> inactive`
- `active -> unavailable`
- `inactive -> active`
- `any -> failed`

- `SourceRegistry.lastSyncStatus`:
- `idle -> success`
- `idle -> partial`
- `idle -> failed`
- `idle -> throttled`
- `throttled -> success`
- `failed -> partial`
- `partial -> success`
