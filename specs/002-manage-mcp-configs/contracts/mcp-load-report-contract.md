# Contract: MCP Load Report

## Purpose

Defines output for MCP discovery, validation, interpolation, and load outcomes.

## Report Fields

- `startedAt`: load start timestamp.
- `finishedAt`: load end timestamp.
- `totalDiscovered`: discovered MCP files.
- `totalLoaded`: successfully loaded server entries.
- `totalSkipped`: skipped entries/files.
- `totalFailed`: failed entries/files.
- `fileResults`: per-file status records.

## Per-File Result Fields

- `filePath` (string)
- `status` (`loaded | skipped | failed`)
- `loadedServerCount` (number)
- `failedServerCount` (number)
- `issues` (array):
- `severity` (`warning | error`)
- `code` (stable string)
- `message` (actionable, sanitized)

## Behavioral Guarantees

- Valid entries load even when some files or entries fail.
- Failed entries include at least one error issue.
- Unresolved `${VAR}` placeholders are reported as errors.
- Secret values are never printed in logs.

## Example (Informative)

```json
{
  "startedAt": "2026-03-05T10:00:00Z",
  "finishedAt": "2026-03-05T10:00:01Z",
  "totalDiscovered": 2,
  "totalLoaded": 1,
  "totalSkipped": 0,
  "totalFailed": 1,
  "fileResults": [
    {
      "filePath": "MCPs/bright-data.json",
      "status": "loaded",
      "loadedServerCount": 1,
      "failedServerCount": 0,
      "issues": []
    },
    {
      "filePath": "MCPs/invalid.json",
      "status": "failed",
      "loadedServerCount": 0,
      "failedServerCount": 1,
      "issues": [
        {
          "severity": "error",
          "code": "ENV_VAR_UNRESOLVED",
          "message": "Required variable API_TOKEN is not defined in MCPs/.env"
        }
      ]
    }
  ]
}
```
