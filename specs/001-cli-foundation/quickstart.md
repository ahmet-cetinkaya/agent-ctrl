# Quickstart Guide: CLI Foundation

**Feature**: 001-cli-foundation
**Date**: 2025-02-10

## Prerequisites

- **Bun** v1.0+ installed: https://bun.sh
- **Git** for version control
- **Code editor** (VS Code, Cursor, etc.)

## Setup Development Environment

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/agent-ctrl.git
cd agent-ctrl

# Install dependencies
bun install

# Verify setup
bun run --version
```

### 2. Project Structure

```
agent-ctrl/
├── src/
│   ├── core/
│   │   ├── domain/          # Entity definitions
│   │   └── application/     # Use cases
│   ├── infrastructure/
│   │   ├── adapters/        # Platform adapters
│   │   └── scanners/        # Directory scanning
│   └── presentation/
│       └── cli/             # Commander.js commands
├── tests/
│   ├── contract/
│   ├── integration/
│   └── unit/
├── package.json
├── tsconfig.json
└── README.md
```

## Development Workflow

### Running the CLI

```bash
# Development mode with hot reload
bun run dev

# Build for production
bun run build

# Run built binary
bun run start
```

### Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test --coverage

# Run specific test file
bun test tests/unit/rule.test.ts

# Watch mode for development
bun test --watch
```

## Common Tasks

### Adding a New Command

1. Create command handler in `src/presentation/cli/commands/`:

```typescript
// src/presentation/cli/commands/my-command.ts
import { Command } from "commander";

export const myCommand = new Command("my-command").description("Description of my command").action(async () => {
  // Command logic here
});
```

2. Register in `src/presentation/cli/index.ts`:

```typescript
import { myCommand } from "./commands/my-command";

program.addCommand(myCommand);
```

### Adding a New Platform Adapter

1. Create adapter in `src/infrastructure/adapters/`:

```typescript
// src/infrastructure/adapters/GeminiAdapter.ts
import type { PlatformAdapter } from "../../core/domain/PlatformAdapter";

export class GeminiAdapter implements PlatformAdapter {
  // Implement adapter interface
}
```

2. Register in adapter factory:

```typescript
// src/infrastructure/adapters/index.ts
export { GeminiAdapter } from "./GeminiAdapter";
```

### Adding Domain Entities

1. Define entity in `src/core/domain/entities/`:

```typescript
// src/core/domain/entities/MyEntity.ts
export class MyEntity {
  constructor(
    public readonly id: string,
    public readonly value: string
  ) {}
}
```

2. Add validation rules as needed

## Debugging

### Verbose Output

```bash
agent-ctrl -v rule ls
```

### Debug Mode

```bash
# Set NODE_DEBUG environment variable
NODE_DEBUG=* agent-ctrl rule ls
```

### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Testing Guide

### Unit Tests

Test domain entities and use cases in isolation:

```typescript
// tests/unit/entities/Rule.test.ts
import { describe, it, expect } from "bun:test";
import { Rule } from "@/core/domain/entities/Rule";

describe("Rule", () => {
  it("should create a rule from valid file", () => {
    const rule = Rule.fromPath("/path/to/my-rule.md");
    expect(rule.id).toBe("my-rule");
  });
});
```

### Integration Tests

Test CLI commands end-to-end:

```typescript
// tests/integration/init.test.ts
import { describe, it, expect } from "bun:test";
import { exec } from "child_process";

describe("agent-ctrl init", () => {
  it("should create project structure", async () => {
    // Test implementation
  });
});
```

### Contract Tests

Test adapter against platform config format:

```typescript
// tests/contract/claude-adapter.test.ts
describe("ClaudeAdapter", () => {
  it("should produce valid Claude Code config", () => {
    // Test against Claude Code schema
  });
});
```

## Code Quality

### Linting

```bash
bun run lint
```

### Type Checking

```bash
bun run type-check
```

### Formatting

```bash
bun run format
```

## Contributing

1. Create a feature branch from `main`
2. Implement your changes with tests
3. Run tests: `bun test`
4. Run linting: `bun run lint`
5. Commit with conventional commits
6. Push and create a pull request

## Getting Help

- Run `agent-ctrl --help` for command reference
- Run `agent-ctrl <command> --help` for command-specific help
- Check the [README.md](../../README.md) for project documentation
- Open an issue on GitHub for bugs or feature requests

## Environment Variables

| Variable                 | Description                             | Default       |
| ------------------------ | --------------------------------------- | ------------- |
| `AGENT_CTRL_CLAUDE_HOME` | Override base home used for `~/.claude` | User home dir |
| `AGENT_CTRL_VERBOSE`     | Enable debug logging                    | `false`       |
| `NODE_ENV`               | Environment mode                        | `development` |

## Troubleshooting

### "Command not found"

Make sure you've built the CLI:

```bash
bun run build
bun link  # Creates global symlink
```

### "Permission denied" errors

Check file permissions:

```bash
ls -la ~/.claude/
chmod u+w ~/.claude/CLAUDE.md
```

### Tests failing locally

Clean and reinstall:

```bash
rm -rf node_modules bun.lockb
bun install
```
