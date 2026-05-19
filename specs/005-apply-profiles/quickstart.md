# Quickstart: Apply Project Profiles

## Setup

1. Ensure your project has a `.agent-ctrl/` directory with base configuration
2. Create a profile directory under `.agent-ctrl/profiles/`:

```bash
mkdir -p .agent-ctrl/profiles/debug/rules
mkdir -p .agent-ctrl/profiles/debug/skills
```

3. Add profile-specific artifacts:

```bash
# Add a debug-specific rule
cp path/to/debug-rules.md .agent-ctrl/profiles/debug/rules/

# Add a debug skill
cp -r path/to/debug-skill/ .agent-ctrl/profiles/debug/skills/
```

## Usage

### Apply a profile to a platform

```bash
agent-ctrl apply profile debug claude
```

### Preview changes without writing

```bash
agent-ctrl apply profile debug claude --dry-run
```

### Apply with verbose output

```bash
agent-ctrl apply profile debug claude --verbose
```

### Skip confirmation prompt

```bash
agent-ctrl apply profile debug claude --no-prompt
```

## Expected Behavior

- Profile artifacts merge with base configuration
- Profile artifacts take precedence over base artifacts of the same name
- For skills/commands: if profile contains a matching directory, it replaces the base version entirely
- For MCP configs: field-level merge (profile fields override, unspecified fields retained)
- Empty profiles apply base configuration with an informational message

## Testing

```bash
# Run profile-related tests
bun test tests/unit/ProfileMerger.test.ts
bun test tests/unit/ProfileScanner.test.ts
bun test tests/unit/ApplyProfileCommand.test.ts
bun test tests/integration/apply-profile.test.ts
```
