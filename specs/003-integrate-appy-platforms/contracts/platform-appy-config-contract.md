# Contract: Platform Appy Configuration

## Purpose

Defines required behavior for writing `appy` configuration across OpenCode, Gemini, Qwen, Kilo, Antigravity, Codex, Cursor, and Windsurf adapters.

## Managed Entry Identity

- Managed command identity: `appy`.
- Scope: only the selected platform is evaluated and updated in a run.

## Per-Platform Behavioral Contract

| Platform    | Required Behavior                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenCode    | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings                                                             |
| Gemini      | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings                                                             |
| Qwen        | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings                                                             |
| Kilo        | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings                                                             |
| Antigravity | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings                                                             |
| Codex       | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings using documented Codex configuration/customization surfaces |
| Cursor      | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings using documented Cursor rule/configuration surfaces         |
| Windsurf    | Create `appy` if missing, replace conflicting `appy`, preserve non-`appy` settings using documented Windsurf rule/workflow surfaces            |

## Merge and Conflict Rules

- Existing valid `appy` entry + equivalent desired payload => `unchanged`.
- Existing invalid/outdated/conflicting `appy` entry => replace with desired valid payload.
- Duplicate managed `appy` entries are not allowed after apply.
- Unrelated user-defined entries MUST be preserved.

## Reporting Contract

- Each run MUST emit the selected-platform final status: `success`, `unchanged`, or `failure`.
- `failure` output MUST include actionable reason.
- Status output MUST map to command exit semantics defined in CLI contract.

## Idempotency Contract

- Repeated apply runs for the same platform with no input changes MUST converge to `unchanged` with no duplicate managed `appy` entries.
