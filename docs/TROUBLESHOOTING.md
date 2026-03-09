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

1. By default, `agent-ctrl apply <platform>` targets documented global user configuration when the platform supports it.
2. To target project configuration in the current folder, add `--project`.
3. Use `--path <root>` when you want to override the platform's default user root.
4. Re-run with `--dry-run` to confirm target path without writing.

### Permission denied while writing configuration

**Symptom**: write failure with permission message.

**Resolution**:

1. Verify directory permissions for the selected platform config path.
2. For global user scope, ensure the platform's documented user configuration root is writable.
3. If needed, use a custom writable root: `--path /custom/root`.
4. Re-run command after updating permissions.

### Expected `unchanged` but got `success`

**Symptom**: repeated apply run reports `success`.

**Resolution**:

1. Ensure you run the same platform and scope for both executions.
2. Check for external edits in the platform's managed guidance, workflow, or settings files between runs.
3. Re-run once more; deterministic content should settle to `unchanged` if no differences remain.

## Registry Sync

### Missing SkillsMP credentials

**Symptom**: sync or search reports missing SkillsMP API key.

**Resolution**:

1. Export `SKILLSMP_API_KEY` or `SKILLSMP_TOKEN`.
2. Prefer storing the key in `.agent-ctrl/.env`.
3. Or pass `--api-key <value>` to `skill sync`, `skill search --refresh`, `skill add --refresh`, or `skill update --refresh`.
4. Re-run `agent-ctrl skill sync --query "<value>"`.
5. Confirm cached results still appear for earlier successful syncs if the source remains unavailable.

### Missing Smithery credentials

**Symptom**: sync or search reports Smithery authentication failure.

**Resolution**:

1. Export `SMITHERY_API_KEY` or `SMITHERY_TOKEN`.
2. Prefer storing the key in `.agent-ctrl/.env`.
3. Or pass `--api-key <value>` to `mcp sync`, `mcp search --refresh`, `mcp add --refresh`, or `mcp update --refresh`.
4. Re-run `agent-ctrl mcp sync`.
5. Use `agent-ctrl mcp search <query>` after a successful sync to confirm the cache is populated.

### Quota or rate-limit reached

**Symptom**: SkillsMP or Smithery sync reports throttling, quota exhaustion, or partial success.

**Resolution**:

1. Reduce the sync scope, especially for SkillsMP query/category windows.
2. Wait for the source quota window to reset.
3. Re-run with `--refresh` only when you actually need a fresh source request.

### Cached data looks stale

**Symptom**: list or search output shows old versions or old timestamps.

**Resolution**:

1. Re-run `agent-ctrl skill sync --refresh --query "<value>"` for the affected SkillsMP scope.
2. Re-run `agent-ctrl mcp sync --refresh` for the Smithery catalog.
3. Use `agent-ctrl skill ls` or `agent-ctrl mcp ls` to confirm the last successful sync timestamp.
