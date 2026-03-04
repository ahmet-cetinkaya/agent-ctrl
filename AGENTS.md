# Repository Guidelines

## Project Structure & Module Organization

Core code lives under `src/` and follows a layered design:

- `src/core/`: domain entities, value objects, errors, and application use-cases.
- `src/infrastructure/`: filesystem, scanners, adapters, and platform integrations.
- `src/presentation/cli/`: CLI commands and command wiring.

Tests live in `tests/` and are split by type (`unit/`, `integration/`, `contract/`). Build output goes to `dist/`. Supporting docs are in `docs/`, and helper scripts are in `scripts/` plus `packages/acore-scripts/`.

## Build, Test, and Development Commands

- `bun run dev`: run the CLI entrypoint directly for local development.
- `bun run build`: compile the CLI into `dist/`.
- `bun run start`: run the built CLI with Node.js.
- `bun test`: run the test suite.
- `bun run lint` or `bun run type-check`: run TypeScript checks (`tsc --noEmit`).
- `bun run format` / `bun run format:check`: apply or verify formatting.

## Coding Style & Naming Conventions

This repository uses TypeScript (`strict: true`) and Prettier:

- 2-space indentation, semicolons, double quotes, trailing commas (`es5`), print width 120.
- Prefer explicit types and avoid `any`.
- Keep architecture boundaries clear (`core` should not depend on `presentation`).
- File naming follows existing patterns: entities/value objects in `PascalCase.ts`; command files in lower snake/case-like names (for example `agent_ls.ts`, `apply.ts`).
- Use path aliases where appropriate (`@/`, `@core/*`, `@infrastructure/*`, `@presentation/*`).

## Testing Guidelines

Use Bun’s test runner (`bun:test`). Place tests under matching layer paths in `tests/unit/...` and name files `*.test.ts` (for example `RuleScanner.test.ts`). Add unit tests for new logic and integration tests when behavior crosses module boundaries.

## Commit & Pull Request Guidelines

Commits follow Conventional Commits, often with optional scopes:

- Examples: `feat: ...`, `fix(cli): ...`, `refactor(architecture): ...`, `test: ...`, `docs: ...`, `chore: ...`.

For PRs, include:

- Clear description of what changed and why.
- Linked issue(s) when available.
- Test evidence (commands run, key output).
- Docs updates when user-facing behavior or commands change.
