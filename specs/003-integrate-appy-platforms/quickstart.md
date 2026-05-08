# Quickstart: Apply Platform Apply Integration

## Prerequisites

- Repository dependencies installed.
- Project contains standard artifact directories (`rules/`, `skills/`, `agents/`).
- You are on branch `003-integrate-apply-platforms`.

## 1. Verify Command Help

```bash
bun run dev apply --help
```

Confirm supported platform values include:

- `opencode`
- `gemini`
- `qwen`
- `kilo`
- `antigravity`
- `codex`
- `cursor`
- `windsurf`

## 2. Run Apply For One Platform

Example:

```bash
bun run dev apply opencode
```

Expected behavior:

- Only OpenCode is processed.
- Output shows OpenCode result as `success`, `unchanged`, or `failure`.

## 3. Repeat For Each Platform (Research Each)

Run each command independently:

```bash
bun run dev apply opencode
bun run dev apply gemini
bun run dev apply qwen
bun run dev apply kilo
bun run dev apply antigravity
bun run dev apply codex
bun run dev apply cursor
bun run dev apply windsurf
```

Expected behavior for each run:

- Exactly one selected platform is processed.
- Missing/unsupported platform input fails with guidance and no writes.
- Conflicting existing `apply` entries are replaced with valid managed `apply` configuration.
- Unrelated configuration entries remain intact.

## 4. Verify Idempotency

Run one platform command twice:

```bash
bun run dev apply gemini
bun run dev apply gemini
```

Expected behavior:

- First run: typically `success`.
- Second run: `unchanged` (exit code 0).
- No duplicate `apply` entries are introduced.

## 5. Dry Run Validation

```bash
bun run dev apply qwen --dry-run
```

Expected behavior:

- Selected-platform intended changes are shown.
- No filesystem write side effects.

## 6. Test and Type-Check

```bash
bun test
bun run type-check
```

Expected behavior:

- Apply feature tests pass.
- Type checks pass under strict mode.

## Validation Notes (2026-03-07)

- `bun run type-check`: PASS.
- `bun test`: all tests passed (`193 pass`, `0 fail`), including selected-platform apply unit/integration/contract suites.
- Runner note: in this environment, `bun test` still returned non-zero despite all tests passing and coverage summary being emitted; treat test case outcomes as passed and investigate local Bun coverage exit behavior separately if strict CI exit handling is required.
