# Data Model: CLI Foundation

**Feature**: 001-cli-foundation
**Date**: 2025-02-10
**Phase**: 1 - Design & Contracts

## Overview

This document defines the core domain entities for the agent-ctrl CLI tool. The data model follows Domain-Driven Design principles with clear separation between domain logic and external concerns.

## Entity Definitions

### Rule

Represents a behavioral rule defined in a markdown file.

| Field      | Type   | Description                                    | Validation                       |
| ---------- | ------ | ---------------------------------------------- | -------------------------------- |
| `id`       | string | Unique identifier (filename without extension) | Required, non-empty              |
| `filename` | string | Original filename including extension          | Must end in `.md` or `.markdown` |
| `path`     | string | Absolute path to the markdown file             | Must be readable file            |
| `type`     | enum   | Artifact type discriminator                    | `"rule"`                         |

**Identification**: Filename without extension (e.g., `my-rule` from `my-rule.md`)

**Uniqueness**: Unique by `id` within a project

**State Transitions**: N/A (static file reference)

---

### Skill

Represents a capability definition in a directory structure.

| Field           | Type   | Description                          | Validation                       |
| --------------- | ------ | ------------------------------------ | -------------------------------- |
| `id`            | string | Unique identifier (directory name)   | Required, non-empty              |
| `directoryName` | string | Name of the skill directory          | Required, non-empty              |
| `path`          | string | Absolute path to the skill directory | Must contain readable `SKILL.md` |
| `type`          | enum   | Artifact type discriminator          | `"skill"`                        |

**Identification**: Directory name (e.g., `my-skill` from `skills/my-skill/`)

**Uniqueness**: Unique by `id` within a project

**State Transitions**: N/A (static directory reference)

---

### Agent

Represents a persona definition in a markdown file.

| Field      | Type   | Description                                    | Validation                       |
| ---------- | ------ | ---------------------------------------------- | -------------------------------- |
| `id`       | string | Unique identifier (filename without extension) | Required, non-empty              |
| `filename` | string | Original filename including extension          | Must end in `.md` or `.markdown` |
| `path`     | string | Absolute path to the markdown file             | Must be readable file            |
| `type`     | enum   | Artifact type discriminator                    | `"agent"`                        |

**Identification**: Filename without extension (e.g., `my-agent` from `my-agent.md`)

**Uniqueness**: Unique by `id` within a project

**State Transitions**: N/A (static file reference)

---

### Project

Represents the root project directory containing all artifacts.

| Field          | Type    | Description                   | Validation                 |
| -------------- | ------- | ----------------------------- | -------------------------- |
| `rootPath`     | string  | Absolute path to project root | Must exist, be a directory |
| `rulesPath`    | string  | Path to rules directory       | `$rootPath/rules`          |
| `skillsPath`   | string  | Path to skills directory      | `$rootPath/skills`         |
| `agentsPath`   | string  | Path to agents directory      | `$rootPath/agents`         |
| `commandsPath` | string  | Path to commands directory    | `$rootPath/commands`       |
| `rules`        | Rule[]  | Discovered rules              | Loaded lazily on scan      |
| `skills`       | Skill[] | Discovered skills             | Loaded lazily on scan      |
| `agents`       | Agent[] | Discovered agents             | Loaded lazily on scan      |

**State Transitions**:

- `UNINITIALIZED` → `INITIALIZED`: After `agent-ctrl init` creates directory structure
- `INITIALIZED` → `SCANNED`: After list operation populates artifacts array

---

### Artifact (Union Type)

A discriminated union representing any discoverable artifact.

```typescript
type Artifact = Rule | Skill | Agent;

// Discriminator field
interface ArtifactBase {
  id: string;
  path: string;
  type: "rule" | "skill" | "agent";
}
```

---

### PlatformConfiguration

Represents a target platform's configuration format.

| Field          | Type                                | Description                                 |
| -------------- | ----------------------------------- | ------------------------------------------- |
| `platformName` | string                              | Target platform identifier (e.g., "claude") |
| `configPath`   | string                              | Path to primary platform file               |
| `rules`        | Array<{name: string, path: string}> | Rule mappings included in state             |
| `skills`       | Array<{name: string, path: string}> | Skill mappings included in state            |
| `agents`       | Array<{name: string, path: string}> | Agent mappings included in state            |

**Known Platforms**:

- `claude`: Claude Code (`~/.claude/CLAUDE.md` + `~/.claude/.agent-ctrl.json`)

---

### ValidationResult

Represents the result of validating a file or directory.

| Field      | Type             | Description                              |
| ---------- | ---------------- | ---------------------------------------- |
| `isValid`  | boolean          | Whether the artifact is valid            |
| `artifact` | Artifact \| null | The artifact if valid, null otherwise    |
| `error`    | string \| null   | Error message if invalid, null otherwise |

---

### ScanResult

Represents the result of scanning a directory.

| Field        | Type       | Description                           |
| ------------ | ---------- | ------------------------------------- |
| `artifacts`  | Artifact[] | Successfully discovered artifacts     |
| `warnings`   | string[]   | Warnings for skipped/invalid files    |
| `errorCount` | number     | Count of files that failed validation |

---

## Value Objects

### ArtifactType

Enum of supported artifact types.

```typescript
enum ArtifactType {
  RULE = "rule",
  SKILL = "skill",
  AGENT = "agent",
}
```

### FileExtension

Supported markdown file extensions.

```typescript
const MARKDOWN_EXTENSIONS = [".md", ".markdown"] as const;
```

---

## Relationships

```
Project (1) ──────< (N) Artifact
    │                     │
    │                     ├─> Rule (0..N)
    │                     ├─> Skill (0..N)
    │                     └─> Agent (0..N)
    │
    └─> Contains directories: rules/, skills/, agents/, commands/

PlatformConfiguration (1) ──────< (N) Artifact
```

---

## Validation Rules

### File Validation (Rules, Agents)

1. Path must end in `.md` or `.markdown`
2. File must be readable (fs.constants.R_OK)
3. File must exist
4. Path must be absolute

### Directory Validation (Skills)

1. Directory must exist
2. Directory must be readable
3. Directory must contain `SKILL.md` file
4. `SKILL.md` must be readable

### Project Validation

1. Root path must exist and be a directory
2. Standard subdirectories must exist for scanning
3. All artifact paths must be within project root (path traversal protection)

---

## Error Types

| Error Type    | Exit Code | Description                                       |
| ------------- | --------- | ------------------------------------------------- |
| `UserError`   | 1         | Invalid input, missing files, validation failures |
| `SystemError` | 2         | Permissions, I/O errors, system failures          |
| `Warning`     | N/A       | Non-fatal issues reported to user                 |

---

## JSON Schema Examples

### Rule

```json
{
  "id": "my-rule",
  "filename": "my-rule.md",
  "path": "/home/user/project/rules/my-rule.md",
  "type": "rule"
}
```

### Skill

```json
{
  "id": "my-skill",
  "directoryName": "my-skill",
  "path": "/home/user/project/skills/my-skill",
  "type": "skill"
}
```

### Agent

```json
{
  "id": "my-agent",
  "filename": "my-agent.md",
  "path": "/home/user/project/agents/my-agent.md",
  "type": "agent"
}
```

### Project

```json
{
  "rootPath": "/home/user/project",
  "rulesPath": "/home/user/project/rules",
  "skillsPath": "/home/user/project/skills",
  "agentsPath": "/home/user/project/agents",
  "commandsPath": "/home/user/project/commands",
  "rules": [],
  "skills": [],
  "agents": []
}
```
