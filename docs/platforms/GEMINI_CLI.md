# Gemini CLI Platform Configuration

## Technical Overview

The Gemini CLI is a command-line AI workflow tool designed to integrate Google's Gemini models into local development environments. Its configuration architecture utilizes a sophisticated hierarchical merging system based on JSON files (`settings.json`) and Markdown context files (`GEMINI.md`). This multi-tiered system allows for flexible configuration at the system, user, and project levels.

Configuration precedence in the Gemini CLI dictates that settings from more specific (or higher authority) locations override general defaults. The load order and precedence hierarchy is structured as follows (from lowest to highest priority):

1.  **Built-in Defaults:** Hardcoded values within the CLI.
2.  **System Defaults File:** Read-only global installation defaults.
3.  **User Settings (Global):** User-specific preferences stored in `~/.gemini/settings.json`.
4.  **Project Settings:** Workspace-specific configurations located in `.gemini/settings.json` (applied only if the workspace is trusted).
5.  **System Settings File:** System-wide overrides or policies (e.g., `/etc/gemini-cli/settings.json`), which override workspace and user settings.
6.  **Remote Admin Settings:** Highest priority settings enforced via the Admin Controls API.
7.  **Environment Variables:** Runtime overrides loaded from `.env` files or the shell environment.
8.  **Command-Line Arguments:** Temporary overrides provided at launch.

---

## Global Configuration

Global configuration defines the default behavior, authentication, and overarching context for all Gemini CLI sessions executed by the current user.

### Step-by-Step Global Setup

**1. Create the Global Configuration Directory**
By default, the Gemini CLI utilizes a `.gemini` directory in the user's home folder.

```bash
mkdir -p ~/.gemini
```

_(Optional: You can change the global configuration path by setting the `GEMINI_CLI_HOME` environment variable.)_

**2. Configure Authentication and Environment Variables**
The Gemini CLI relies heavily on environment variables for authentication and basic setup. You can place these in a global `.env` file or export them via your shell profile (e.g., `~/.bashrc` or `~/.zshrc`).

```bash
# Add to ~/.gemini/.env or your shell profile
export GEMINI_API_KEY="your-api-key"
export GEMINI_MODEL="gemini-2.5-pro"
```

Alternatively, run the interactive authentication command to let the CLI store the credentials automatically:

```bash
gemini auth
```

**3. Define Global Settings (`settings.json`)**
Create or edit `~/.gemini/settings.json` to define your global preferences.

```bash
touch ~/.gemini/settings.json
```

_Example `~/.gemini/settings.json`:_

```json
{
  "ui": {
    "theme": "dark",
    "hideBanner": true
  },
  "context": {
    "discoveryMaxDirs": 200
  }
}
```

**4. Define Global Context (`GEMINI.md`)**
To provide persistent instructions, guidelines, and context to the Gemini model across all your projects, create a global `GEMINI.md` file.

```bash
touch ~/.gemini/GEMINI.md
```

Add universal coding standards or workflow rules to this file. The model will load this hierarchical memory into the context of every session.

---

## Project-Specific Configuration

Project-specific configuration allows developers to tailor the Gemini CLI's behavior to the immediate repository. This includes overriding global models, defining project boundaries, and providing highly specific codebase context. Project settings override global user settings but require the workspace to be "trusted."

### Step-by-Step Project Setup

**1. Create the Project Configuration Directory**
Navigate to the root of your project and create the `.gemini` directory.

```bash
cd /path/to/your/project
mkdir -p .gemini
```

**2. Configure Project Settings (`settings.json`)**
Create a `settings.json` file inside the `.gemini` directory to establish project-level overrides.

```bash
touch .gemini/settings.json
```

_Example `.gemini/settings.json`:_

```json
{
  "model": {
    "name": "gemini-2.5-pro",
    "temperature": 0.2
  },
  "sessionRetention": {
    "enabled": true
  }
}
```

**3. Provide Project Context (`GEMINI.md`)**
Create a `GEMINI.md` file in the root of the project (or within `.gemini/`). This file is critical for providing the model with project-specific instructions, architecture details, and knowledge.

```bash
touch GEMINI.md
```

_Note: The CLI searches for context files not just in the root, but iteratively down through subdirectories up to a configured limit, allowing for granular module-level instructions._

**4. Configure Project Environment Variables (`.env`)**
If your project requires specific API keys or environmental overrides for the CLI, place an `.env` file in the project directory. The CLI parses environment variables starting from the current directory, moving up to the Git root.

```bash
touch .env
```

Add project-specific variables such as `GOOGLE_CLOUD_PROJECT` or `GEMINI_MODEL`.

---

## Source Documentation References

- [Gemini CLI Configuration Overview](https://google-gemini.github.io/gemini-cli/docs/get-started/configuration.html)
- [Gemini CLI Environment Variables](https://www.mintlify.com/google-gemini/gemini-cli/reference/environment-variables)
- [Gemini CLI settings.json Reference](https://mintlify.com/google-gemini/gemini-cli/reference/settings)
- [Gemini CLI GitHub Repository Docs](https://github.com/google-gemini/gemini-cli/blob/93694c6a65dab0ac431b77bf6caadfea4c0e3c78/docs/cli/configuration.md)
- [DeepWiki: Gemini CLI Settings Management](https://deepwiki.com/google-gemini/gemini-cli/4.3-settings-management)
