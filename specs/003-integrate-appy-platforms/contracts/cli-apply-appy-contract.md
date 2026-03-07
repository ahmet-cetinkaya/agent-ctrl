# Contract: CLI Apply Appy

## Purpose

Defines the command contract for applying `appy` integration to one selected platform per run.

## Usage

```bash
agent-ctrl apply <platform> [options]
```

## Arguments

| Argument   | Type   | Required | Allowed Values                                                                     |
| ---------- | ------ | -------- | ---------------------------------------------------------------------------------- |
| `platform` | string | yes      | `opencode`, `gemini`, `qwen`, `kilo`, `antigravity`, `codex`, `cursor`, `windsurf` |

## Options

| Option       | Type | Description                                                          |
| ------------ | ---- | -------------------------------------------------------------------- |
| `--dry-run`  | flag | Show intended selected-platform changes without writing              |
| `--override` | flag | Apply selected-platform replace/cleanup behavior for managed entries |

## Input Guarantees

- Missing `platform` MUST fail with usage guidance and perform no writes.
- Unsupported `platform` MUST fail with an actionable error and perform no writes.

## Output Guarantees

- Command processes exactly one platform per execution.
- Command MUST output selected-platform status as one of `success`, `unchanged`, or `failure`.
- `unchanged` MUST be treated as a successful command outcome.

## Exit Semantics

- Exit code `0`: selected-platform result is `success` or `unchanged`.
- Non-zero exit code: selected-platform result is `failure`.

## Error Contract

- Errors MUST identify the selected platform and failure reason.
- Errors MUST be actionable (e.g., invalid input, missing path, permission denied).
- Errors MUST NOT imply changes were written when no writes occurred.
