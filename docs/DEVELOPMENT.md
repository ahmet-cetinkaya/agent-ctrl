# Development

## Getting Started

### Prerequisites

- **Bun** >= 1.0.0
- **Node.js** >= 18.0.0 (if not using Bun)

### Setup

```bash
# Clone repository
git clone https://github.com/yourusername/agent-ctrl.git
cd agent-ctrl

# Install dependencies
bun install

# Run in development mode
bun run dev
```

### Build

```bash
# Build for production
bun run build

# Build with watch mode
bun run build --watch
```

### Testing

```bash
# Run all tests
bun test

# Run specific test file
bun test path/to/test.test.ts

# Run with coverage
bun test --coverage
```

### Linting

```bash
# Run linter
bun run lint

# Fix issues automatically
bun run lint:fix

# Type check
bun run type-check
```

---

## Project Structure

```
agent-ctrl/
├── src/
│   ├── core/
│   │   ├── domain/          # Domain models
│   │   └── application/     # Use cases
│   ├── infrastructure/      # External integrations and remote catalog adapters
│   └── presentation/
│       └── cli/             # CLI interface
├── tests/                   # Test files
├── docs/                    # Documentation
└── CLAUDE.md                # This file
```

---

## Coding Guidelines

### TypeScript

- Use strict mode
- Prefer interfaces over types for object shapes
- Use `readonly` for immutable properties
- Avoid `any` - use `unknown` when type is truly unknown

### Remote Catalog Credentials

- `agent-ctrl init` should leave `.agent-ctrl/.env`, `.agent-ctrl/.env.example`, and `.agent-ctrl/.gitignore` ready for local registry credentials.
- Remote catalog commands read registry keys from the configuration-root `.env` file.
- CLI `--api-key` flags override `.env` values for the current process only.

### Error Handling

```typescript
// Use custom error types
class AdapterError extends Error {
  constructor(
    public platform: string,
    message: string
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

// Never swallow errors silently
try {
  await adapter.apply(artifacts);
} catch (error) {
  if (error instanceof AdapterError) {
    // Handle specific error
  }
  throw error; // Always rethrow unless specifically handled
}
```

### Remote Catalog Development

- Keep source-specific HTTP behavior in `src/infrastructure/features/catalog/clients/`.
- Keep cache/state persistence in `src/infrastructure/features/catalog/caching/`.
- Keep lifecycle orchestration in `src/core/application/features/skill/*` and `src/core/application/features/mcp/*`.
- Do not persist raw credentials. Only persist sanitized auth state, cache metadata, and operation summaries.
- Preserve the existing local `skill ls` and `mcp ls` flows when extending catalog behavior.

### Validation

Use Zod for all external inputs:

```typescript
import { z } from "zod";

const RuleSchema = z.object({
  name: z.string().min(1),
  content: z.string().min(1),
  metadata: z
    .object({
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

// Validate
const result = RuleSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error);
}
```

---

## Adding a New Adapter

### 1. Create Adapter Class

```typescript
// src/infrastructure/adapters/MyPlatformAdapter.ts
import { Adapter, Artifacts, ConfigOutput } from "@/core/domain/Adapter";

export class MyPlatformAdapter implements Adapter {
  async apply(artifacts: Artifacts): Promise<ConfigOutput> {
    // Transform artifacts to platform-specific format
  }

  validate(config: ConfigOutput): ValidationResult {
    // Validate platform requirements
  }

  getPlatform(): string {
    return "myplatform";
  }
}
```

### 2. Register Adapter

```typescript
// src/infrastructure/adapters/index.ts
export { MyPlatformAdapter } from "./MyPlatformAdapter";

// src/presentation/cli/index.ts
import { MyPlatformAdapter } from "@/infrastructure/adapters";

const adapters = {
  claude: new ClaudeAdapter(),
  myplatform: new MyPlatformAdapter(),
};
```

### 3. Add Tests

```typescript
// tests/infrastructure/adapters/MyPlatformAdapter.test.ts
import { describe, it, expect } from "bun:test";
import { MyPlatformAdapter } from "@/infrastructure/adapters/MyPlatformAdapter";

describe("MyPlatformAdapter", () => {
  it("should transform artifacts correctly", async () => {
    const adapter = new MyPlatformAdapter();
    const result = await adapter.apply(mockArtifacts);
    expect(result).toMatchPlatformFormat();
  });
});
```

---

## Adding a New Artifact Type

### 1. Define Domain Model

```typescript
// src/core/domain/MyArtifact.ts
export interface MyArtifact {
  id: string;
  content: string;
  metadata?: ArtifactMetadata;
}
```

### 2. Create Scanner

```typescript
// src/core/application/artifacts/myArtifact.ts
export class MyArtifactScanner {
  async scan(directory: string): Promise<MyArtifact[]> {
    // Scan and parse artifacts
  }
}
```

### 3. Add CLI Commands

```typescript
// src/presentation/cli/commands/myArtifact.ts
import { Command } from "commander";

export const myArtifactCommand = new Command("myartifact")
  .description("Manage my artifacts")
  .argument("<id>", "Artifact identifier")
  .action((id) => {
    // Handle command
  });
```

---

## Release Process

### Version Bump

```bash
# Bump version
bun run version:bump --type major|minor|patch

# Update CHANGELOG
bun run changelog:update
```

### Publish

```bash
# Build
bun run build

# Publish to npm
bun run publish

# Create GitHub release
bun run release:create
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Ensure all tests pass
6. Submit a pull request

### Pull Request Guidelines

- Descriptive title following conventional commits
- Link to related issues
- Describe changes and motivation
- Include testing instructions
