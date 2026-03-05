# Research: CLI Foundation

**Feature**: 001-cli-foundation
**Date**: 2025-02-10
**Phase**: 0 - Research & Technology Decisions

## Overview

This document captures research findings and technology decisions for the CLI Foundation feature. All decisions are grounded in best practices for CLI development, TypeScript/Bun ecosystems, and the specific requirements of managing AI agent configurations.

## Technology Decisions

### 1. Runtime: Bun

**Decision**: Use Bun as the TypeScript runtime

**Rationale**:

- Fast startup time (<100ms) critical for CLI tools
- Native TypeScript support - no build step required for development
- Modern tooling with built-in test runner and package manager
- Node.js API compatibility allows using existing ecosystem packages
- Cross-platform support (macOS, Linux, Windows)

**Alternatives Considered**:

- **Node.js with ts-node**: Slower startup, requires additional tooling
- **Deno**: Less mature ecosystem, fewer CLI-focused packages
- **Compiled binary (Rust/Go)**: Better performance but harder to extend, longer iteration cycle

**References**:

- Bun CLI best practices: https://bun.sh/docs/cli/cli
- TypeScript CLI development patterns

### 2. CLI Framework: Commander.js

**Decision**: Use Commander.js for command-line interface

**Rationale**:

- Industry standard with 10M+ weekly downloads
- Declarative API for defining commands, options, and arguments
- Built-in help generation and validation
- Composable with middleware pattern
- Strong TypeScript support

**Alternatives Considered**:

- **Yargs**: More verbose API, steeper learning curve
- **Clite**: Auto-configuration but less control over output format
- **Oclif**: Full CLI framework, too heavy for this scope

**References**:

- Commander.js documentation: https://commander.js.org/
- CLI argument parsing best practices

### 3. File System: Native Node Modules

**Decision**: Use `node:fs` and `node:path` modules

**Rationale**:

- Built-in, no additional dependencies
- Cross-platform path handling
- Promise-based API for async operations
- Stable and well-documented

**Alternatives Considered**:

- **globby**: For pattern matching, but can be added later if needed
- **fs-extra**: Not needed - built-in fs/promises is sufficient

### 4. Configuration Format: Managed Markdown + JSON State

**Decision**: Use managed Markdown for `CLAUDE.md` content and JSON for persisted artifact state

**Rationale**:

- Aligns with Claude's `CLAUDE.md` memory-file workflow
- JSON state enables deterministic merge semantics for preserving existing mappings
- Ubiquitous support across tools

**Alternatives Considered**:

- **YAML**: More human-readable but adds dependency
- **TOML**: Not native to Node.js ecosystem

### 5. Architecture: Clean Architecture / DDD

**Decision**: Apply Clean Architecture principles with Domain-Driven Design

**Rationale**:

- **Separation of Concerns**: Business logic independent of CLI framework and file system
- **Testability**: Domain layer can be tested without infrastructure
- **Extensibility**: New platform adapters can be added without modifying core logic
- **Maintainability**: Clear boundaries between layers

**Layer Structure**:

- **Domain**: Core entities (Rule, Skill, Agent, Project) with no external dependencies
- **Application**: Use cases (init, list, apply) orchestrating domain objects
- **Infrastructure**: File system operations, platform adapters
- **Presentation**: CLI command handlers using Commander.js

**Alternatives Considered**:

- **Simple MVC**: Would couple business logic to CLI framework
- **Monolithic structure**: Harder to test and extend with new platforms

## Integration Points

### Claude Code Configuration

**Target Location**: `~/.claude/CLAUDE.md` (managed rule section) and `~/.claude/.agent-ctrl.json` (state mapping)

**Format**:

```markdown
<!-- agent-ctrl:start -->

# Rule content copied from project files

<!-- agent-ctrl:end -->
```

```json
{
  "rules": [{ "name": "rule-name", "path": "/absolute/path/to/rule.md" }],
  "skills": [{ "name": "skill-name", "path": "/absolute/path/to/skill" }],
  "agents": [{ "name": "agent-name", "path": "/absolute/path/to/agent.md" }]
}
```

**Additional Sync Targets**: `~/.claude/skills`, `~/.claude/agents`, `~/.claude/commands`

**Merge Strategy**: Merge by artifact name (existing + incoming) unless `--override` is used, in which case managed artifacts are cleaned before syncing

### Directory Scanning

**Pattern**: Iterator pattern with lazy evaluation

**Rationale**:

- Handle 1000+ files without loading all into memory
- Stream results for display
- Early termination on user interruption

**Validation Rules** (from clarifications):

- Rules: `.md` or `.markdown` extension, readable file
- Skills: Directory containing readable `SKILL.md` file
- Agents: `.md` or `.markdown` extension, readable file
- Identification: Filename without extension (or directory name for skills)

### Error Handling

**Pattern**: Result type (neverthrow-style)

**Rationale**:

- Explicit error handling prevents silent failures
- Type-safe error propagation
- Clear error messages for users

**Error Categories**:

1. **User Errors**: Invalid input, missing files → Clear message + exit code 1
2. **System Errors**: Permissions, I/O errors → Clear message + exit code 2
3. **Warnings**: Skipped files (continue processing) → Aggregate display at end

## Performance Considerations

### Targets (from success criteria):

- Init: <5 seconds
- List (100+ files): <1 second
- Apply (10-50 artifacts): <3 seconds

### Strategies:

- **Lazy file reading**: Only read metadata until content is needed
- **Parallel scanning**: Use Promise.all() for independent directory scans
- **Path caching**: Resolve absolute paths once per session
- **Incremental config merge**: Merge as artifacts are discovered

## Security Considerations

### Path Traversal Prevention:

- Validate all paths are within project directory
- Resolve paths using `path.resolve()` and check they start with project root

### File Access:

- Check read permissions before attempting operations
- Handle permission errors gracefully

### Content Security:

- Parse markdown as text content only
- Never interpret or execute file contents as code

## Testing Strategy

### Unit Tests:

- Domain layer: Entity validation, business rules
- Application layer: Use case orchestration with mocks
- Infrastructure layer: File operations with temp directories

### Integration Tests:

- CLI command end-to-end with real file system
- Adapter contract tests against Claude Code config format

### Test Framework:

- Bun test runner (built-in)
- Test fixtures in `tests/fixtures/`

## Open Questions Resolved

| Question                                                    | Answer                                    | Source                           |
| ----------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| What happens if Claude Code config directory doesn't exist? | Auto-create directory structure           | Clarification Session 2025-02-10 |
| What makes a "valid" markdown file?                         | .md/.markdown extension + readable        | Clarification Session 2025-02-10 |
| How are artifacts identified?                               | Filename without extension                | Clarification Session 2025-02-10 |
| How to handle invalid files during scan?                    | Continue processing, show warnings at end | Clarification Session 2025-02-10 |
| What content in sample config file?                         | Minimal template with helpful comments    | Clarification Session 2025-02-10 |

## References

- [Bun Documentation](https://bun.sh/docs)
- [Commander.js](https://commander.js.org/)
- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)
- [Node.js File System API](https://nodejs.org/api/fs.html)
- [Claude Code Configuration](https://github.com/anthropics/claude-code)
