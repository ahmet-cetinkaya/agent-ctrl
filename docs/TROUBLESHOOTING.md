# Troubleshooting

## `apply` command

### Unsupported platform error

**Symptom**: `Platform '<value>' not supported`.

**Resolution**:

1. Use one of: `opencode`, `gemini`, `qwen`, `kilo`, `antigravity`, `codex`, `cursor`, `windsurf`.
2. Re-run with an explicit selected platform:
   `agent-ctrl apply <platform>`.

### Missing or incorrect scope behavior

**Symptom**: configuration written to user scope when project scope was expected (or reverse).

**Resolution**:

1. Ensure environment overrides are set as intended:
   - `AGENT_CTRL_APPLY_SCOPE=project|user`
   - `AGENT_CTRL_CODEX_TRUSTED_PROJECT=true|false`
   - `AGENT_CTRL_CURSOR_SCOPE=user` (to force user scope)
   - `AGENT_CTRL_WINDSURF_SCOPE=global` (to force global scope)
2. Re-run with `--dry-run` to confirm target path without writing.

### Permission denied while writing configuration

**Symptom**: write failure with permission message.

**Resolution**:

1. Verify directory permissions for the selected platform config path.
2. Use a writable project directory or set `AGENT_CTRL_HOME` to a writable path for user-scope targets.
3. Re-run command after updating permissions.

### Expected `unchanged` but got `success`

**Symptom**: repeated apply run reports `success`.

**Resolution**:

1. Ensure you run the same platform and scope for both executions.
2. Check for external edits in managed appy config files between runs.
3. Re-run once more; deterministic content should settle to `unchanged` if no differences remain.
