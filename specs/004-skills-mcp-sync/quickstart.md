# Quickstart: Skills and MCP Sync

## Prerequisites

- Repository dependencies installed.
- Access to a writable agent-ctrl config root.
- Credentials configured for SkillsMP and/or Smithery when those sources require authenticated access.
- You are on branch `004-skills-mcp-sync`.

## 1. Review Existing Local State

```bash
bun run dev skill ls
bun run dev mcp ls
```

Expected behavior:

- Local managed skills are listed from `skills/`.
- Local managed MCPs are listed from `mcps/`.
- Existing list commands remain usable before any remote sync is introduced.

## 2. Synchronize Source Catalogs

```bash
bun run dev skill sync --query "code review"
bun run dev mcp sync
```

Expected behavior:

- SkillsMP query/category discovery windows and the Smithery server registry are synchronized into local cache state.
- Output shows whether each source used fresh data, cached data, or encountered partial failures.
- Sync summaries include changed, unchanged, skipped, and failed counts.

## 3. Search the Catalogs

```bash
bun run dev skill search review --capability code-review
bun run dev mcp search github --status compatible
```

Expected behavior:

- Results include description, capabilities, source identifier, version, compatibility state, and cache freshness context.
- SkillsMP search uses the documented search surface and completes from cache unless `--refresh` is requested or the cache is stale.
- Smithery search uses the documented paginated registry surface and can surface connection/configuration requirements from server details.

## 4. Activate One Skill and One MCP

```bash
bun run dev skill add skillsmp:code-review
bun run dev mcp add smithery:github
```

Expected behavior:

- Each compatible item becomes locally managed and source-tracked.
- Activation does not modify unrelated existing skills or MCP files.
- Incompatible items are blocked with actionable reasons.
- If a SkillsMP item was not already cached, installation metadata may be resolved during the add flow from the source item page or bundle metadata.

## 5. Refresh and Update Managed Items

```bash
bun run dev skill update --all --refresh
bun run dev mcp update --all --refresh
```

Expected behavior:

- The tool refreshes source state before evaluating updates.
- Only managed items with compatible newer versions are updated.
- Summary output distinguishes updated, unchanged, skipped, and failed items.

## 6. Deactivate Managed Items

```bash
bun run dev skill rm code-review
bun run dev mcp rm github
```

Expected behavior:

- The selected managed item is deactivated locally.
- Historical source metadata remains available for future inspection and reactivation.

## 7. Validate Behavior

```bash
bun test
bun run type-check
```

Expected behavior:

- Unit tests cover cache, sync, compatibility, and lifecycle policies.
- Integration tests cover end-to-end source sync and activation flows.
- Contract tests confirm stable CLI behavior and output semantics.
