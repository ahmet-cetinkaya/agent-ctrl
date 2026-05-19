# Cursor Platform Configuration

## Technical Overview

Cursor IDE utilizes a highly contextual rules-based configuration system to instruct its underlying AI agents. Instead of traditional configuration maps, Cursor relies on "Rules for AI" defined in Markdown. These rules guide the agent’s coding style, architectural decisions, and boundaries.

The configuration architecture supports both global settings and project-specific scoping. Cursor has recently transitioned from a legacy single-file system (`.cursorrules`) to a modern, granular directory-based system (`.cursor/rules/*.mdc`). This modern system uses YAML frontmatter to conditionally activate rules based on file paths (glob patterns) or user interaction, optimizing the AI's context window.

Configuration precedence evaluates from the highest specificity to the lowest:

1.  **Team Rules:** Managed via the Cursor dashboard (Enterprise/Team plans).
2.  **Project Rules (Directory):** Granular rules defined in `.cursor/rules/*.mdc`.
3.  **Project Rules (Legacy/Fallback):** A single `.cursorrules` file or `AGENTS.md`/`CLAUDE.md` in the project root.
4.  **User (Global) Rules:** Global preferences defined in Cursor Settings.

---

## Global Configuration

Global rules act as your universal AI preferences. They apply to every Cursor project you open on your machine. This scope is ideal for personal habits, overarching language preferences, and interaction styles (e.g., "always respond in English", "prefer concise explanations").

### Step-by-Step Global Setup

**1. Access Global Settings**
Global rules are not configured via a local file in your home directory, but rather through Cursor's internal settings UI.

- Open Cursor IDE.
- Navigate to **Cursor Settings** (Menu > Cursor > Preferences, or `Cmd/Ctrl + ,`).
- Go to **General** > **Rules for AI**.

**2. Define Global Rules**
In the input box provided, enter your global markdown rules. Keep these extremely broad to prevent contaminating project-specific workflows.

_Example Global Rule Input:_

```markdown
- Always respond in clear, concise English.
- Avoid unnecessary apologies or pleasantries.
- Always assume TypeScript strict mode is enabled.
- Default to using double quotes for strings in JSON, but single quotes in JavaScript/TypeScript.
```

**3. Enable Project Rule Merging**
Ensure the toggle for **"Include .cursorrules file"** (or project rules) is enabled in this same settings pane so that your global rules do not block project-specific instructions.

---

## Project-Specific Configuration

Project-level rules enforce team conventions, specific tech stacks, and domain knowledge. Cursor's modern approach uses the `.cursor/rules/` directory containing `.mdc` files. This allows the AI to conditionally load rules only when relevant, saving tokens and improving accuracy.

### Step-by-Step Project Setup

**1. Create the Rules Directory**
Navigate to the root of your project and create the modern Cursor rules directory.

```bash
cd /path/to/your/project
mkdir -p .cursor/rules
```

**2. Create a Conditionally Activated Rule (`.mdc`)**
Create Markdown files with an `.mdc` extension. These files require YAML frontmatter to tell Cursor _when_ to apply the rule.

```bash
touch .cursor/rules/frontend-standards.mdc
```

_Example `.cursor/rules/frontend-standards.mdc`:_

```yaml
---
description: React and Tailwind coding standards
globs: ["src/components/**/*.tsx", "src/pages/**/*.tsx"]
alwaysApply: false
---
# Frontend Standards

- Use React functional components with arrow functions.
- Use Tailwind CSS for styling; do not use inline styles.
- Extract complex logic into custom hooks.
- All components must be exported as `default`.
```

_Because of the `globs` definition, Cursor will only inject these rules when you are actively editing or discussing `.tsx` files in the `src/components` or `src/pages` directories._

**3. Create an Always-On Project Rule**
If you have rules that must apply to the entire project (e.g., git workflows, overarching architecture), you can set them to always apply.

```bash
touch .cursor/rules/project-core.mdc
```

_Example `.cursor/rules/project-core.mdc`:_

```yaml
---
description: Core project architecture and Git rules
globs: ["*"]
alwaysApply: true
---
# Core Rules

- The project uses a strict monolithic architecture.
- Never modify the `package.json` without explicit user permission.
- Always run `npm run test` before suggesting a Git commit.
```

**4. (Optional) Legacy `.cursorrules` File**
For older setups or simple projects, Cursor still supports a single `.cursorrules` plain text file in the project root. It acts as an `alwaysApply: true` rule for the entire project. However, migrating to `.cursor/rules/*.mdc` is highly recommended for performance and context management.

```bash
touch .cursorrules
```

---

## Source Documentation References

- [Cursor Docs: Customization - Rules](https://cursor.com/help/customization/rules)
- [CursorDocs.com: Rules for AI](https://cursordocs.com/en/docs/context/rules-for-ai)
- [Design.dev: Cursor Rules Guide](https://design.dev/guides/cursor-rules/)
- [TeachMeIDEA: Cursor Rules vs .cursorrules](https://teachmeidea.com/cursor-rules-cursorrules-project-context/)
- [RP Digital Innovations: How to Configure Cursor AI Rules](https://rpdi.us/blog/cursor-ai-rules-file-how-to-configure/)
