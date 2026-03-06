# Quickstart: Dynamic MCP Config Management

## Prerequisites

- Repository dependencies installed.
- Access to your agent-ctrl config root directory (outside project repository).

## 1. Create MCP Config File

Create:
`<agent-ctrl-config-root>/mcps/bright-data.json`

```json
{
  "mcpServers": {
    "Bright Data": {
      "command": "npx",
      "args": ["@brightdata/mcp"],
      "env": {
        "API_TOKEN": "${API_TOKEN}"
      }
    }
  }
}
```

## 2. Create mcps/.env

Create:
`<agent-ctrl-config-root>/mcps/.env`

```dotenv
API_TOKEN=your-api-token-here
```

## 3. Run Apply

1. Execute the existing `apply` flow.
2. Set `AGENT_CTRL_CONFIG_DIR` to your external config root.
3. The loader discovers `mcps/*.json`, reads `mcps/.env`, resolves `${VAR}` in any JSON string, and passes resolved env values into server `env`.

Example:

```bash
AGENT_CTRL_CONFIG_DIR=/path/to/agent-ctrl-config bun run dev apply claude
```

## 4. Verify

1. Confirm valid server entries are loaded.
2. Confirm unresolved placeholders fail with actionable errors.
3. Confirm logs do not expose raw secret values.
