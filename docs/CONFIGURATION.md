# Configuration

## Directory Structure

When you run `agent-ctrl init`, it creates the following structure:

```
.agent-ctrl/
├── .env               # Your API keys (not committed)
├── .env.example       # Template for .env
├── .gitignore         # Git ignore patterns
├── agents/            # Agent persona definitions
├── commands/          # Reusable command definitions
├── mcps/              # MCP server configurations
├── rules/             # Rule files (coding standards, etc.)
└── skills/            # Installed skills
```

## Environment Variables

Create `.agent-ctrl/.env` with your API keys:

```bash
SKILLSMP_API_KEY=your_skillsmp_key
SMITHERY_API_KEY=your_smithery_key
```

### Credential Precedence

1. `--api-key` flag (highest priority, single command only)
2. Environment file (`.agent-ctrl/.env`)
3. System environment variables (lowest priority)

## Artifact Types

### Rules (`rules/`)

Coding standards, guidelines, and rules that agents should follow. Add markdown files directly to this directory.

**Example:**

```markdown
# Coding Style Rules

- Use 2-space indentation
- Use semicolons
- Use double quotes
- Use trailing commas
```

```bash
# List rules
agent-ctrl rule ls
```

### Skills (`skills/`)

Discoverable capabilities. Add markdown files directly to this directory, or install from SkillsMP registry.

**Example:**

```markdown
# Code Review Skill

## Description

Performs thorough code reviews focusing on security, performance, and best practices.

## Capabilities

- Security vulnerability detection
- Performance optimization suggestions
- Code style consistency checks
```

```bash
# Add from SkillsMP
agent-ctrl skill add skillsmp:code-review

# List installed skills
agent-ctrl skill ls

# Update skills
agent-ctrl skill update --all --refresh
```

### Agents (`agents/`)

Agent persona definitions and configurations. Add markdown files directly to this directory.

**Example:**

```markdown
# Senior Developer Agent

You are a senior software developer with expertise in system design and code quality.

## Responsibilities

- Architect scalable solutions
- Review pull requests
- Mentor junior developers
- Ensure code quality standards
```

```bash
# List agents
agent-ctrl agent ls
```

### Commands (`commands/`)

Reusable command definitions for agents. Add markdown files directly to this directory. You can organize commands into subdirectories.

**Example:**

```markdown
# Explain Code Command

Explain what the selected code does in clear, concise language.

## Usage

When user requests explanation of code selection:

1. Read the selected code carefully
2. Identify the purpose and functionality
3. Explain in beginner-friendly terms
4. Note any potential issues or improvements
```

```bash
# List commands
agent-ctrl command ls
```

### MCP Servers (`.agent-ctrl/mcps/`)

MCP server configurations for Model Context Protocol integration. You can add servers from Smithery registry, or create custom JSON configurations.

```bash
# Add from Smithery
agent-ctrl mcp add smithery:github

# List configured MCPs
agent-ctrl mcp ls

# Update MCPs
agent-ctrl mcp update --all --refresh
```

#### Custom JSON Configuration

Add your own MCP server configurations by creating JSON files in `.agent-ctrl/mcps/`. Each file should contain a top-level `mcpServers` object.

**Stdio Transport (default):**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-filesystem", "/path/to/allowed/files"],
      "env": {
        "API_KEY": "${API_KEY}"
      },
      "cwd": "/custom/working/directory"
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-github"]
    }
  }
}
```

**HTTP Transport:**

```json
{
  "mcpServers": {
    "my-http-server": {
      "type": "http",
      "url": "https://mcp.example.com/server"
    }
  }
}
```
