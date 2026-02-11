# Feature Specification: CLI Foundation

**Feature Branch**: `001-cli-foundation`
**Created**: 2025-02-10
**Status**: Draft
**Input**:

```User description: "### Phase 1: Foundation (v0.1)
- [ ] Basic CLI structure (Bun + Commander)
- [ ] Directory scanner (`rules/`, `skills/`, `agents/`)
- [ ] `apply claude` adapter (Local file mapping)
```

## Clarifications

### Session 2025-02-10

- Q: When applying configurations to Claude Code, what should happen if the Claude Code configuration directory doesn't exist on the system? → A: Automatically create the directory structure and write the config file even if Claude Code isn't installed
- Q: When scanning for artifacts, how should the system determine if a markdown file or SKILL.md is "valid"? → A: File extension + file is readable (not corrupted/locked)
- Q: How are rules, skills, and agents uniquely identified when listed and mapped to configurations? → A: Filename without extension (e.g., "my-rule" from "my-rule.md")
- Q: When scanning artifacts, what should happen if some files fail validation (e.g., corrupted, locked, wrong extension)? → A: Continue processing valid files, display warnings for skipped files at the end
- Q: When initializing a new project with `agent-ctrl init`, what content should be included in the sample configuration file that gets created? → A: Minimal template with helpful comments explaining the structure and common examples

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Initialize Agent Control Project (Priority: P1)

As a developer, I want to create a new agent control project directory so that I can manage AI agent configurations using the standard directory pattern.

**Why this priority**: This is the entry point for all users - without the ability to initialize a project, no other features can be used. This provides immediate value by establishing the project structure.

**Independent Test**: Can be fully tested by running the init command and verifying that the standard directory structure (rules/, skills/, agents/) is created, and a basic configuration file exists.

**Acceptance Scenarios**:

1. **Given** an empty directory, **When** I run `agent-ctrl init`, **Then** the directories rules/, skills/, agents/, and commands/ are created
2. **Given** an existing directory, **When** I run `agent-ctrl init`, **Then** I receive a clear error message explaining the directory must be empty or non-existent
3. **Given** a newly initialized project, **When** I list the directory contents, **Then** I see all expected directories and a sample configuration file with helpful comments and examples

---

### User Story 2 - Scan and Display Project Artifacts (Priority: P1)

As a developer, I want to view all available rules, skills, and agents in my project so that I can understand what configurations are available to apply.

**Why this priority**: This is fundamental to the core value proposition - users must be able to discover and inspect their artifacts before they can manage or apply them. Without scanning, the CLI has no awareness of the user's configurations.

**Independent Test**: Can be fully tested by creating sample files in rules/, skills/, and agents/ directories, then running list commands to verify all artifacts are discovered and displayed correctly.

**Acceptance Scenarios**:

1. **Given** a project with rules in rules/, **When** I run `agent-ctrl rule ls`, **Then** I see a list of all rule files with their names
2. **Given** a project with skills in skills/, **When** I run `agent-ctrl skill ls`, **Then** I see a list of all skill directories with their names
3. **Given** a project with agents in agents/, **When** I run `agent-ctrl agent ls`, **Then** I see a list of all agent definitions with their names
4. **Given** an empty rules/ directory, **When** I run `agent-ctrl rule ls`, **Then** I see a message indicating no rules are found
5. **Given** a project with nested directories, **When** I run any list command, **Then** only top-level artifacts are displayed (subdirectories are not scanned recursively)

---

### User Story 3 - Apply Configuration to Claude Code (Priority: P1)

As a developer, I want to apply my agent configurations to Claude Code so that my rules, skills, and agents are available when I use the Claude Code CLI.

**Why this priority**: This delivers the core value of the product - transforming local configurations into a format that an AI platform can understand and use. Without this, the project is just file organization without actual utility.

**Independent Test**: Can be fully tested by creating sample artifacts, running the apply command, and verifying that the Claude Code configuration file is created or updated with the expected mappings.

**Acceptance Scenarios**:

1. **Given** a project with at least one rule, **When** I run `agent-ctrl apply claude`, **Then** the Claude Code config file is created with the rule mapped
2. **Given** a project with multiple skills, **When** I run `agent-ctrl apply claude`, **Then** all skills are mapped in the Claude Code config file
3. **Given** an existing Claude Code config, **When** I run `agent-ctrl apply claude`, **Then** existing configuration is preserved and new mappings are added
4. **Given** a project with no artifacts, **When** I run `agent-ctrl apply claude`, **Then** I receive a warning message indicating no artifacts were found but the config file is still created
5. **Given** a successfully applied configuration, **When** I run `agent-ctrl apply claude` again, **Then** I see a success message confirming the configuration was updated
6. **Given** a project with artifacts but Claude Code is not installed, **When** I run `agent-ctrl apply claude`, **Then** the directory structure and config file are created automatically

---

### Edge Cases

- What happens when the user does not have write permissions to the Claude Code configuration directory?
- How does the system handle malformed or unreadable markdown files in rules/, skills/, or agents/? (Clarified: continue processing valid files, display warnings for skipped files at the end)
- What happens when the Claude Code configuration file is locked or in use by another process?
- How does the system handle special characters or spaces in file/directory names?
- What happens when the user interrupts a long-running operation (e.g., during apply)?
- How does the system handle projects with extremely large numbers of artifacts (1000+ files)?
- What happens when the Claude Code configuration directory does not exist? (Clarified: automatically create the directory structure and write the config file)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a command-line interface accessible via an `agent-ctrl` command
- **FR-002**: The system MUST create the standard directory structure (rules/, skills/, agents/, commands/) when initializing a new project, along with a sample configuration file (agent-ctrl.config.json) containing a minimal template with helpful comments. The sample config MUST include example mappings for at least one rule, one skill, and one agent with inline comments explaining each field.
- **FR-003**: The system MUST scan the rules/ directory and discover all files with .md or .markdown extensions that are readable
- **FR-004**: The system MUST scan the skills/ directory and discover all directories containing a readable SKILL.md file
- **FR-005**: The system MUST scan the agents/ directory and discover all files with .md or .markdown extensions that are readable
- **FR-006**: The system MUST map discovered rules to the target platform's rule format
- **FR-007**: The system MUST map discovered skills to the target platform's skills format
- **FR-008**: The system MUST map discovered agents to the target platform's agents format
- **FR-009**: The system MUST generate or update the Claude Code configuration file in the correct location
- **FR-010**: The system MUST preserve existing configuration when applying updates to Claude Code
- **FR-011**: The system MUST provide clear error messages when operations fail
- **FR-012**: The system MUST validate that the target directory is empty before initialization
- **FR-013**: The system MUST display a list of discovered artifacts when listing rules, skills, or agents, identified by filename without extension
- **FR-014**: The system MUST handle cases where no artifacts are found with appropriate messaging
- **FR-015**: The system MUST provide help text describing available commands and their usage
- **FR-016**: When the Claude Code configuration directory does not exist, the system MUST automatically create the directory structure and write the config file
- **FR-017**: When scanning artifacts, if some files fail validation the system MUST continue processing valid files and display warnings for skipped files at the end

### Key Entities

- **Rule**: A behavioral rule defined in a markdown file (.md or .markdown extension, readable) in the rules/ directory that guides AI agent behavior. Identified by filename without extension.
- **Skill**: A capability definition consisting of a directory containing a readable SKILL.md file that defines what an AI agent can do. Identified by directory name.
- **Agent**: A persona definition in a markdown file (.md or .markdown extension, readable) in the agents/ directory that defines an AI agent's personality and approach. Identified by filename without extension.
- **Project Directory**: The root directory containing the standard structure (rules/, skills/, agents/, commands/)
- **Configuration Mapping**: The translation of local artifacts into the format required by a target platform (e.g., Claude Code config.json)
- **Sample Configuration**: A template file (agent-ctrl.config.json) created during init that demonstrates the structure for defining project metadata, artifact patterns, and platform targets. Contains example entries with explanatory comments.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can initialize a new project in under 5 seconds
- **SC-002**: Users can list all artifacts in a project with 100+ files in under 1 second
- **SC-003**: Users can apply configurations to Claude Code in under 3 seconds for a typical project (10-50 artifacts)
- **SC-004**: The CLI responds to all commands with clear success or error messages
- **SC-005**: 100% of standard directory structure (rules/, skills/, agents/) is created successfully on init
- **SC-006**: All valid markdown files in rules/, skills/, and agents/ are discovered and displayed correctly
- **SC-007**: The Claude Code configuration file is created or updated with correct file paths for all mapped artifacts
- **SC-008**: Users can complete the full workflow (init, add artifacts, apply) in their first session without referring to documentation
