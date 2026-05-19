# Qwen Code Platform Configuration

## Technical Overview

Qwen Code is an open-source, terminal-first AI coding agent developed by QwenLM. It supports integration with the command line as well as IDEs like VS Code, Zed, and JetBrains. Its configuration system utilizes a multi-layered JSON architecture for functional settings (`settings.json`) alongside Markdown files (`AGENTS.md` and `.qwen/rules/`) for context injection and behavioral rules.

The configuration hierarchy resolves in the following order (from lowest to highest precedence):

1.  **Built-in Defaults:** Hardcoded application defaults.
2.  **System Defaults File:** System-wide base configurations.
3.  **User Settings (Global):** Global configurations stored at `~/.qwen/settings.json`.
4.  **Project Settings:** Repository-level settings located at `.qwen/settings.json`.
5.  **System Settings File:** Override policies enforced by the system.
6.  **Environment Variables:** Runtime overrides, potentially loaded from `.env` files.
7.  **Command-Line Arguments:** Execution overrides (e.g., `--acp`, `--approve-all`).

---

## Global Configuration

Global configuration applies persistent default models, API credentials (via providers), and base behavioral rules across all of your Qwen Code sessions. This prevents you from needing to manually configure providers for every new repository.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory**
The primary user-level configuration is stored in your home directory.

```bash
mkdir -p ~/.qwen
```

**2. Configure Global Settings (`settings.json`)**
Create or edit `~/.qwen/settings.json` to define your model providers, authentication types, and default fallback variables. This is the **recommended** place to declare model access.

```bash
touch ~/.qwen/settings.json
```

_Example `~/.qwen/settings.json`:_

```json
{
  "security": {
    "auth": {
      "selectedType": "openai"
    }
  },
  "model": {
    "name": "qwen-max"
  },
  "modelProviders": [
    {
      "protocol": "openai",
      "id": "qwen-max",
      "envKey": "QWEN_API_KEY",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
    }
  ]
}
```

**3. Define Global Agent Rules (`AGENTS.md`)**
To enforce persistent behaviors globally (e.g., "always respond in a specific language" or "use strict TypeScript"), create a global markdown file.

```bash
touch ~/.qwen/AGENTS.md
```

**4. Define Conditional Global Rules (`.qwen/rules/`)**
Qwen Code supports path-based context rule injection. You can create modular rule files with YAML frontmatter to apply rules conditionally.

```bash
mkdir -p ~/.qwen/rules
touch ~/.qwen/rules/global-typescript.md
```

_Example `global-typescript.md` frontmatter:_

```yaml
---
paths: ["**/*.ts", "**/*.tsx"]
---
# TypeScript Guidelines
Always use strict mode and explicit return types.
```

---

## Project-Specific Configuration

Project-specific configuration ensures Qwen Code respects local boundaries, custom linters, unique agent tools (Skills), and repository-specific context. Project settings override user-level settings.

### Step-by-Step Project Setup

**1. Create the Project Directory**
Navigate to your project root and create the `.qwen` directory.

```bash
cd /path/to/your/project
mkdir -p .qwen
```

**2. Configure Project Settings (`settings.json`)**
Create `.qwen/settings.json` to override global configurations, define local MCP servers, or configure tool permissions for this specific repository.

```bash
touch .qwen/settings.json
```

_Example `.qwen/settings.json`:_

```json
{
  "tools": {
    "approvalMode": "plan"
  },
  "permissions": {
    "allow": ["read", "run_linter"],
    "ask": ["write", "delete"]
  }
}
```

**3. Provide Project Context (`AGENTS.md` or `QWEN.md`)**
Create an `AGENTS.md` or `QWEN.md` file in the project root. Qwen Code automatically loads these files to build project context.

```bash
touch AGENTS.md
```

_Example `AGENTS.md`:_

```markdown
# General Rules

- Prefer semantic HTML elements.
- Use Tailwind CSS for styling.

## Code Review

- All API endpoints must validate authentication.
- Database queries must use parameterized statements.
```

_Note: The `## Code Review` section is explicitly parsed by Qwen Code's `/review` agent pipeline._

**4. Provide Modular / Conditional Rules (`.qwen/rules/`)**
For granular control over context injection—reducing token waste and preventing conflicting guidance—utilize the local rules directory.

```bash
mkdir -p .qwen/rules
touch .qwen/rules/frontend.md
```

_Example `frontend.md`:_

```yaml
---
paths: ["src/frontend/**/*"]
---
- React components must not use inline styles.
- Do not expose internal paths in error messages.
```

**5. Provide Project Review Rules (`.qwen/review-rules.md`)**
If you prefer to separate code review criteria entirely from `AGENTS.md`, you can create a dedicated review rules file. The `/review` agent prioritizes this file above all others.

```bash
touch .qwen/review-rules.md
```

---

## Source Documentation References

- [Qwen Code GitHub Repository](https://github.com/QwenLM/qwen-code)
- [Qwen Code Configuration Docs](https://github.com/QwenLM/qwen-code/blob/main/docs/users/configuration/settings.md)
- [Qwen Code AGENTS.md Implementation](https://github.com/QwenLM/qwen-code/blob/main/AGENTS.md)
- [Qwen Code Review Features](https://qwenlm.github.io/qwen-code-docs/en/users/features/code-review/)
- [Qwen Code PR #3339: Path-based Context Rule Injection](https://github.com/QwenLM/qwen-code/pull/3339)
