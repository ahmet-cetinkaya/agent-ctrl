# Contract: Platform Apply Configuration

## Purpose

Defines required behavior for writing `apply` configuration across OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, and Windsurf adapters.

## Managed Entry Identity

- Managed command identity: `apply`.
- Scope: only the selected platform is evaluated and updated in a run.

## Per-Platform Behavioral Contract

| Platform    | Required Behavior                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode    | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings                                                             |
| Gemini      | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings                                                             |
| Qwen        | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings                                                             |
| Kilo        | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings                                                             |
| Antigravity | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings                                                             |
| Codex       | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings using documented Codex configuration/customization surfaces |
| Cursor      | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings using documented Cursor rule/configuration surfaces         |
| Windsurf    | Create `apply` if missing, replace conflicting `apply`, preserve non-`apply` settings using documented Windsurf rule/workflow surfaces            |

## Merge and Conflict Rules

- Existing valid `apply` entry + equivalent desired payload => `unchanged`.
- Existing invalid/outdated/conflicting `apply` entry => replace with desired valid payload.
- Duplicate managed `apply` entries are not allowed after apply.
- Unrelated user-defined entries MUST be preserved.

## Reporting Contract

- Each run MUST emit the selected-platform final status: `success`, `unchanged`, or `failure`.
- `failure` output MUST include actionable reason.
- Status output MUST map to command exit semantics defined in CLI contract.

## Idempotency Contract

- Repeated apply runs for the same platform with no input changes MUST converge to `unchanged` with no duplicate managed `apply` entries.
