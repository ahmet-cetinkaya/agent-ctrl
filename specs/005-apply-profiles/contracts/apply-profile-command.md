# Contract: Apply Profile Command

## Command Schema

```
agent-ctrl apply profile <profile_name> <platform> [options]
```

### Arguments

| Name           | Type   | Required | Description                                                 |
| -------------- | ------ | -------- | ----------------------------------------------------------- |
| `profile_name` | string | Yes      | Name of the profile directory under `.agent-ctrl/profiles/` |
| `platform`     | string | Yes      | Target platform (same as `apply <platform>`)                |

### Options

| Flag             | Type    | Default | Description                               |
| ---------------- | ------- | ------- | ----------------------------------------- |
| `-d, --dry-run`  | boolean | false   | Show changes without writing files        |
| `-o, --override` | boolean | false   | Replace conflicting managed configuration |
| `-v, --verbose`  | boolean | false   | Show detailed output including warnings   |
| `--no-prompt`    | boolean | false   | Skip confirmation prompt                  |

### Exit Codes

| Code | Meaning                                                                      |
| ---- | ---------------------------------------------------------------------------- |
| 0    | Profile applied successfully                                                 |
| 1    | User error (profile not found, invalid platform, no `.agent-ctrl` directory) |
| 2    | System error (permission denied, disk full, unexpected failure)              |

### Output Format

**Success**:

```
Applying to <platform>
  ✓ Syncing configuration
  <platform>: success
  Scope: project
  Configuration path: <path>
  Artifacts: <N> rules, <N> skills, <N> agents, <N> commands, <N> MCP servers
  Duration: <N>ms
```

**Empty Profile**:

```
Applying to <platform>
  ✓ Syncing configuration
  <platform>: success
  Note: Profile '<name>' contained no artifacts. Base configuration applied.
  ...
```

**Profile Not Found**:

```
Error: Profile '<name>' not found in .agent-ctrl/profiles/
```

## Profile Directory Schema

```
.agent-ctrl/
├── profiles/
│   └── <profile_name>/
│       ├── rules/          # Optional: Markdown files
│       ├── skills/         # Optional: Directories with SKILL.md
│       ├── agents/         # Optional: Markdown files
│       ├── commands/       # Optional: Markdown files/scripts
│       └── mcps/           # Optional: MCP configuration files
```

All subdirectories are optional. A profile may contain any subset of these directories.
