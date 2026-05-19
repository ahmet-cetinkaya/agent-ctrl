# Windsurf Platform Configuration

## Technical Overview

Windsurf, a next-generation AI IDE built as a fork of VS Code by Codeium, utilizes a dynamic, file-based rules engine to dictate the behavior of its primary AI pair programmer, **Cascade**. Configuration in Windsurf is structured around "Memories," "Rules," and "Workflows."

Instead of traditional `.json` config files for agent behavior, Windsurf relies on plain Markdown files and Markdown files with frontmatter. The platform automatically scans workspaces and global directories, evaluating files based on their location and scope.

Configuration precedence and resolution order in Windsurf is structured as follows (from highest to lowest priority):

1.  **System Level (Enterprise):** Organization-wide rules deployed by IT (e.g., `/etc/windsurf/workflows/`). These are read-only and override all other settings.
2.  **Workspace / Project Level:** Project-specific rules and workflows committed to the repository (e.g., `.windsurf/rules/`, `.windsurf/workflows/`, and `AGENTS.md`).
3.  **Global / User Level:** Machine-wide rules and workflows applying to all projects (e.g., `~/.codeium/windsurf/global_workflows/`).
4.  **Built-in:** Default workflows and templates shipped natively with Windsurf.

---

## Global Configuration

Global configuration in Windsurf applies persistent rules and workflows to Cascade across every project you open on your machine. This is ideal for personal coding styles, language preferences, and generic utility workflows.

### Step-by-Step Global Setup

**1. Access Global Rules via UI**
Global rules are best managed directly through the Windsurf interface.

- Open the **Cascade panel** in the Windsurf IDE.
- Click the **Customizations** icon (often represented as a gear or sliders).
- Navigate to **Global Rules** / **Memories**.
- Define your overarching preferences (e.g., "Always respond in English", "Prefer functional programming patterns").

**2. Create Global Workflows (Directory-Based)**
Workflows are saved prompts that Cascade can follow via slash commands. To create a global workflow that works in all projects:

```bash
mkdir -p ~/.codeium/windsurf/global_workflows
touch ~/.codeium/windsurf/global_workflows/review.md
```

_Example `review.md` content:_

```markdown
# Code Review Workflow

When executing `/review`, analyze the current diff for:

- Security vulnerabilities
- Performance bottlenecks
- Adherence to clean code principles
```

_(Alternatively, you can create these via the UI by clicking `+ Global` in the Workflows panel)._

**3. Configure Advanced IDE Settings**
Global IDE preferences (like granting Cascade access to `.gitignore` files, configuring Dev Containers, or changing the Extension Marketplace) are managed via standard VS Code-style settings.

- Open the Command Palette (`Cmd/Ctrl + Shift + P`).
- Select **Open Windsurf Settings Page**.

---

## Project-Specific Configuration

Project-specific configuration ensures Cascade understands the unique architecture, testing frameworks, and coding standards of your current repository. Windsurf offers two primary mechanisms for project rules: `AGENTS.md` (simple, location-based) and `.windsurf/rules/` (complex, frontmatter-driven).

### Step-by-Step Project Setup

**1. Create a Simple Project Rule (`AGENTS.md`)**
`AGENTS.md` (or `agents.md`) is a plain markdown file. Windsurf automatically infers its scope based on its location in the directory tree.

- If placed in the workspace root, it acts as an **always-on** rule for the entire project.
- If placed in a subdirectory (e.g., `/frontend/AGENTS.md`), it automatically generates a glob pattern (`/frontend/**`) and only applies when working within that directory.

```bash
cd /path/to/your/project
touch AGENTS.md
```

_Example `AGENTS.md`:_

```markdown
# Project Core Guidelines

- This is a Next.js 14 App Router project.
- Always use `pnpm` instead of `npm`.
- Do not modify files in the `/legacy` folder.
```

**2. Create Granular Project Rules (`.windsurf/rules/`)**
For cross-cutting concerns or complex activation logic, use the dedicated rules directory. These rules can be configured to be always on, @mentionable, or attached to specific file globs using frontmatter.

```bash
mkdir -p .windsurf/rules
touch .windsurf/rules/testing.md
```

_(Note: Windsurf uses the `.windsurf/rules/` directory to store rules that dictate how Cascade behaves, similar to Cursor's `.cursor/rules/`)._

**3. Create Project Workflows (`.windsurf/workflows/`)**
To define custom slash commands specific to the project's build or deployment processes:

```bash
mkdir -p .windsurf/workflows
touch .windsurf/workflows/deploy.md
```

_Example `deploy.md`:_

```markdown
# Deployment Workflow

When executing `/deploy`:

1. Run the test suite.
2. If tests pass, execute `pnpm run build`.
3. Provide a summary of the build artifacts.
```

These workflows should be committed to your Git repository so the entire team can access them.

---

## Source Documentation References

- [Windsurf Docs: AGENTS.md](https://docs.codeium.com/windsurf/cascade/agents-md)
- [Windsurf Docs: Workflows](http://docs.codeium.com/windsurf/cascade/workflows)
- [Windsurf Docs: Advanced Configuration](https://docs.codeium.com/windsurf/advanced)
- [Codeium Changelog: Planning Mode, Workflows & File Based Rules](https://codeium.com/changelog/jetbrains)
