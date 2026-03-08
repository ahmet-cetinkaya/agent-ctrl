# Contract: Catalog Sync State

## Purpose

Defines the persisted state required to support cached catalog access, source-tracked lifecycle operations, and partial-failure reporting for SkillsMP and Smithery integrations.

## State Partitions

- **Registry snapshot state**: Cached catalog items and freshness metadata per source registry.
- **Discovery scope state**: Tracked query, category, or managed-item windows used to refresh source data deterministically.
- **Managed integration state**: Source-tracking metadata for active and previously active skills and MCPs.
- **Operation history state**: Sanitized summaries of sync, activation, update, and deactivation actions.

## Required Stored Fields

### Discovery Scope State

- `scopeId`
- `registryId`
- `scopeType`
- `scopeKey`
- `query` (optional)
- `category` (optional)
- `lastRefreshedAt` (optional)

### Registry Snapshot State

- `registryId`
- `scopeId`
- `capturedAt`
- `expiresAt`
- `lastSyncStatus`
- `lastSyncSucceededAt` (optional)
- `throttleUntil` (optional)
- `items[]`

Each stored item MUST include:

- `catalogKey`
- `sourceItemId`
- `itemType`
- `displayName`
- `description` (optional)
- `capabilities[]`
- `sourceVersion` (optional)
- `availabilityState`
- `compatibilityState`
- `lastSeenAt`

### Managed Integration State

- `managedId`
- `catalogKey`
- `itemType`
- `localPath`
- `state`
- `installedVersion` (optional)
- `installedAt`
- `updatedAt` (optional)
- `deactivatedAt` (optional)
- `lastOperationStatus`

### Operation History State

- `operationId`
- `operationType`
- `registryId` (optional)
- `catalogKey` (optional)
- `status`
- `message`
- `occurredAt`

## Behavioral Guarantees

- State MUST distinguish cached source data from active local artifacts.
- State MUST distinguish authoritative full-source snapshots from query/category-scoped discovery windows.
- Removing an upstream item from the latest catalog MUST NOT erase historical managed integration records.
- Secrets and raw credential values MUST NOT be stored in any persisted state file.
- Failed or throttled sync runs MUST preserve the last successful catalog snapshot until a fresher successful sync replaces it.
- Partial-failure runs MUST persist enough information to explain which source or item failed without invalidating unaffected cached data.

## Consistency Rules

- A `ManagedIntegration.catalogKey` MUST match a current or historical catalog item record.
- Catalog item availability and managed activation state MUST be stored independently.
- A registry snapshot MUST reference the discovery scope that produced it.
- A registry snapshot MAY be marked stale, but stale data MUST still identify its capture time and freshness boundary.
- Persisted timestamps MUST use a single comparable format across all state records.
