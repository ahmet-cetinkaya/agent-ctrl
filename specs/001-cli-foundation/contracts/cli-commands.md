# CLI Command Contracts

**Feature**: 001-cli-foundation
**Date**: 2025-02-10
**Phase**: 1 - Design & Contracts

## Overview

This document defines the command-line interface contracts for the agent-ctrl CLI tool. All commands follow standard CLI conventions with clear input/output contracts.

## Global Options

| Option      | Short | Type | Description              | Default |
| ----------- | ----- | ---- | ------------------------ | ------- |
| `--help`    | `-h`  | flag | Display help information | -       |
| `--version` | `-V`  | flag | Display version number   | -       |
| `--verbose` | `-v`  | flag | Enable verbose output    | false   |
| `--quiet`   | `-q`  | flag | Suppress warnings        | false   |

---

## Command: `init`

Initialize a new agent-ctrl project with the standard directory structure.

### Usage

```bash
agent-ctrl init [options]
```

### Options

None

### Arguments

None

### Input Contract

| Precondition     | Description                                |
| ---------------- | ------------------------------------------ |
| Directory exists | Current directory must exist               |
| Directory empty  | Must have no conflicting files/directories |

### Output Contract

**Success (Exit Code: 0)**

```
✓ Created rules/
✓ Created skills/
✓ Created agents/
✓ Created commands/
✓ Created agent-ctrl.config.json

Project initialized successfully! Add artifacts to your directories, then run:
  agent-ctrl rule ls
  agent-ctrl skill ls
  agent-ctrl agent ls
```

**Error - Directory not empty (Exit Code: 1)**

```
✗ Directory is not empty. Please initialize in an empty directory.
```

**Error - Permission denied (Exit Code: 2)**

```
✗ Permission denied: cannot create directories in /path/to/dir
```

### Side Effects

- Creates directories: `rules/`, `skills/`, `agents/`, `commands/`
- Creates file: `agent-ctrl.config.json` with template content

---

## Command: `rule ls`

List all rules discovered in the `rules/` directory.

### Usage

```bash
agent-ctrl rule ls [options]
```

### Options

| Option   | Short | Type | Description    |
| -------- | ----- | ---- | -------------- |
| `--json` | `-j`  | flag | Output as JSON |

### Arguments

None

### Input Contract

| Precondition        | Description                   |
| ------------------- | ----------------------------- |
| Project initialized | `rules/` directory must exist |
| Readable directory  | Must have read permissions    |

### Output Contract

**Success - Rules found (Exit Code: 0)**

```
Rules (3):
  my-rule
  another-rule
  third-rule
```

**Success - No rules (Exit Code: 0)**

```
No rules found in rules/ directory
```

**Success - JSON format**

```json
{
  "artifacts": [
    { "id": "my-rule", "type": "rule", "path": "/absolute/path/to/my-rule.md" },
    {
      "id": "another-rule",
      "type": "rule",
      "path": "/absolute/path/to/another-rule.md"
    }
  ],
  "warnings": []
}
```

**With warnings (Exit Code: 0)**

```
Rules (2):
  my-rule
  another-rule

Warnings:
  - Skipped invalid-file.txt (invalid extension)
  - Could not read locked-file.md (permission denied)
```

**Error - Directory not found (Exit Code: 1)**

```
✗ rules/ directory not found. Run 'agent-ctrl init' first.
```

---

## Command: `skill ls`

List all skills discovered in the `skills/` directory.

### Usage

```bash
agent-ctrl skill ls [options]
```

### Options

| Option   | Short | Type | Description    |
| -------- | ----- | ---- | -------------- |
| `--json` | `-j`  | flag | Output as JSON |

### Arguments

None

### Input Contract

| Precondition        | Description                    |
| ------------------- | ------------------------------ |
| Project initialized | `skills/` directory must exist |
| Readable directory  | Must have read permissions     |

### Output Contract

**Success - Skills found (Exit Code: 0)**

```
Skills (2):
  my-skill
  another-skill
```

**Success - No skills (Exit Code: 0)**

```
No skills found in skills/ directory
```

**Success - JSON format**

```json
{
  "artifacts": [
    { "id": "my-skill", "type": "skill", "path": "/absolute/path/to/my-skill" }
  ],
  "warnings": []
}
```

**With warnings (Exit Code: 0)**

```
Skills (1):
  my-skill

Warnings:
  - Directory incomplete-skill/ missing SKILL.md
  - Could not read locked-skill/SKILL.md (permission denied)
```

---

## Command: `agent ls`

List all agents discovered in the `agents/` directory.

### Usage

```bash
agent-ctrl agent ls [options]
```

### Options

| Option   | Short | Type | Description    |
| -------- | ----- | ---- | -------------- |
| `--json` | `-j`  | flag | Output as JSON |

### Arguments

None

### Input Contract

| Precondition        | Description                    |
| ------------------- | ------------------------------ |
| Project initialized | `agents/` directory must exist |
| Readable directory  | Must have read permissions     |

### Output Contract

**Success - Agents found (Exit Code: 0)**

```
Agents (2):
  my-agent
  another-agent
```

**Success - No agents (Exit Code: 0)**

```
No agents found in agents/ directory
```

**Success - JSON format**

```json
{
  "artifacts": [
    {
      "id": "my-agent",
      "type": "agent",
      "path": "/absolute/path/to/my-agent.md"
    }
  ],
  "warnings": []
}
```

**With warnings (Exit Code: 0)**

```
Agents (1):
  my-agent

Warnings:
  - Skipped invalid-file.txt (invalid extension)
  - Could not read locked-agent.md (permission denied)
```

---

## Command: `apply`

Apply project artifacts to a target platform configuration.

### Usage

```bash
agent-ctrl apply <platform> [options]
```

### Options

| Option      | Short | Type | Description                      |
| ----------- | ----- | ---- | -------------------------------- |
| `--dry-run` | `-d`  | flag | Show changes without applying    |
| `--force`   | `-f`  | flag | Overwrite existing configuration |

### Arguments

| Argument   | Type   | Description                      |
| ---------- | ------ | -------------------------------- |
| `platform` | string | Target platform (e.g., "claude") |

### Input Contract

| Precondition        | Description                                           |
| ------------------- | ----------------------------------------------------- |
| Project initialized | All standard directories must exist                   |
| Platform supported  | Platform must be implemented                          |
| Writable config     | Must have write permissions to target config location |

### Output Contract

**Success - Artifacts applied (Exit Code: 0)**

```
✓ Applied 3 rules to Claude Code
✓ Applied 2 skills to Claude Code
✓ Applied 1 agent to Claude Code

Configuration written to: /home/user/.claude/config.json
```

**Warning - No artifacts found (Exit Code: 0)**

```
⚠ No artifacts found in project. Configuration file created anyway.

Configuration written to: /home/user/.claude/config.json
```

**Success - Dry run (Exit Code: 0)**

```
[Dry run] Would apply 3 rules to Claude Code
[Dry run] Would apply 2 skills to Claude Code
[Dry run] Would apply 1 agent to Claude Code

Would write to: /home/user/.claude/config.json
```

**Error - Platform not supported (Exit Code: 1)**

```
✗ Platform 'gemini' not supported. Supported platforms: claude
```

**Error - Permission denied (Exit Code: 2)**

```
✗ Permission denied: cannot write to /home/user/.claude/config.json
```

**Error - Config locked (Exit Code: 2)**

```
✗ Configuration file is locked or in use. Close Claude Code and try again.
```

### Side Effects

- Creates target config directory if not exists (for `claude` platform)
- Merges with existing configuration (preserves non-conflicting entries)

---

## Error Message Format

All error messages follow this format:

```
✗ <Error type>: <Description>

Run 'agent-ctrl <command> --help' for more information.
```

---

## Version Output

```
agent-ctrl v0.1.0
```

---

## Help Output Format

```
Usage: agent-ctrl [options] [command]

Options:
  -V, --version   Output version number
  -h, --help      Display help information
  -v, --verbose   Enable verbose output
  -q, --quiet     Suppress warnings

Commands:
  init            Initialize a new agent-ctrl project
  rule ls         List all rules
  skill ls        List all skills
  agent ls        List all agents
  apply <platform> Apply artifacts to target platform

Run 'agent-ctrl <command> --help' for more information on a command.
```
