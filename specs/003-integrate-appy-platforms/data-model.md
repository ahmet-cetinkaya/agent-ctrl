# Data Model: Apply Platform Apply Integration

## Entity: PlatformApplyRequest

- Description: Input for a single `apply` execution.
- Fields:
- `projectPath` (string)
- `platform` (enum): `opencode | gemini | qwen | kilo | antigravity | codex | cursor | windsurf`
- `dryRun` (boolean)
- `override` (boolean)
- Validation rules:
- `platform` is required.
- `platform` must be in supported values.
- Missing platform is a user error with no write side effects.

## Entity: PlatformTarget

- Description: Canonical selected platform and adapter resolution metadata.
- Fields:
- `id` (enum): `opencode | gemini | qwen | kilo | antigravity | codex | cursor | windsurf`
- `displayName` (string)
- `configPath` (string)
- `resolved` (boolean)
- Validation rules:
- `id` is unique and maps to exactly one adapter.
- Unsupported values must produce deterministic error message.

## Entity: ApplyIntegrationConfiguration

- Description: Required managed `apply` command configuration for one platform.
- Fields:
- `commandId` (string): `apply`
- `payload` (object): platform-shaped config body for `apply`
- `source` (string): managed by `agent-ctrl`
- `versionTag` (string, optional)
- Validation rules:
- `commandId` is always `apply`.
- Payload must satisfy adapter-specific schema checks.

## Entity: ExistingPlatformConfig

- Description: Current target platform configuration before apply.
- Fields:
- `entries` (map<string, unknown>)
- `hasApplyEntry` (boolean)
- `applyEntryValid` (boolean)
- Validation rules:
- Non-`apply` entries are preserved.
- Invalid/conflicting `apply` entries are replaced, not duplicated.

## Entity: ApplyResult

- Description: Result returned from one selected-platform apply execution.
- Fields:
- `platform` (string)
- `status` (enum): `success | unchanged | failure`
- `configPath` (string)
- `warnings` (string[])
- `errorMessage` (string, optional)
- Validation rules:
- `status=unchanged` is treated as command success.
- `status=failure` includes actionable error message.

## Entity: ApplyCommandExit

- Description: CLI exit behavior tied to apply result.
- Fields:
- `exitCode` (number)
- `resultStatus` (enum): `success | unchanged | failure`
- Validation rules:
- `success` and `unchanged` map to exit code `0`.
- `failure` maps to non-zero exit code.

## Relationships

- One `PlatformApplyRequest` resolves to one `PlatformTarget`.
- One `PlatformTarget` produces one `ApplyIntegrationConfiguration` per run.
- One `ExistingPlatformConfig` is merged with one `ApplyIntegrationConfiguration` to produce one `ApplyResult`.
- One `ApplyResult` determines one `ApplyCommandExit`.

## State Transitions

- `ApplyResult.status`:
- `success -> unchanged` (on subsequent idempotent reruns)
- `failure -> success` (after corrective action and rerun)
- `ExistingPlatformConfig.applyEntryValid`:
- `false -> true` (after replace-on-conflict apply)
