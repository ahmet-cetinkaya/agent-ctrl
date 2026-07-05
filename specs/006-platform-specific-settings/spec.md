# Feature Specification: Platform-Specific Settings Support

**Feature Branch**: `006-platform-specific-settings`  
**Created**: 2025-06-29  
**Status**: Draft  
**Input**: User description: "Implement platform-specific settings support for the agent-ctrl configuration directory by introducing a new settings/ subdirectory with individual folders for each platform (e.g., settings/claude-code/). Update the logic for the apply command so that when it is executed for a specific platform or set of platforms, the settings within the corresponding platform-specific directories are also applied."

## Clarifications

> [!faq]- Session 2025-06-29: Artifact Types & Conflict Resolution
> **Q**: What types of artifacts and how should they be handled in platform-specific settings?
> **A**: All folders and files in the relevant platform folder within settings should be copied exactly as-is to the corresponding platform's config directory.
>
> **Q**: How are conflicts resolved when the same file exists in both standard configuration and platform-specific settings?
> **A**: Platform-specific files override (replace) standard files completely.

> [!faq]- Session 2025-06-29: Platform Names & File Structure
> **Q**: What platform names are valid for platform-specific settings directories?
> **A**: Folder names should only be supported platform names: antigravity, claude, codex, cursor, forgecode, gemini, kilo, opencode, qwen, windsurf.
>
> **Q**: What file types and structure are allowed in platform-specific settings directories?
> **A**: Any file/directory is allowed, content gets copied to the platform config directory.

> [!faq]- Session 2025-06-29: Security Measures
> **Q**: What security measures should be implemented when copying platform-specific settings to config directories?
> **A**: Warnings for symbolic links and path traversal controls.

> [!faq]- Session 2026-06-30: Security Failure Behavior
> **Q**: When path traversal controls detect a security issue (FR-009), what should the system do?
> **A**: Fail with error immediately - stop processing, report security violation to user

> [!faq]- Session 2026-06-30: Platform Naming Convention
> **Q**: Which naming convention should platform settings directories use?
> **A**: Use canonical platform identifiers from SupportedApplyPlatform.ts (claude, cursor, gemini, etc.)

> [!faq]- Session 2026-06-30: Recursive Copy Behavior
> **Q**: How should recursive copy behavior work for directory structures?
> **A**: Recursive copy with no depth limit - copy entire directory tree as-is

> [!faq]- Session 2026-06-30: Success Rate Measurement
> **Q**: How should the 99% success rate (SC-004) be measured?
> **A**: Measure via integration tests - success defined as correct file copy without errors in test suite

> [!faq]- Session 2026-06-30: Backup Policy
> **Q**: Should the system create backups before overriding files?
> **A**: No backups - override directly (Git provides version history)

> [!faq]- Session 2026-06-30: Config File Validation
> **Q**: Should the system validate configuration files after copying them to platform directories?
> **A**: No validation - copy files as-is, let platform tools validate their configs

- Q: Should the system validate configuration files after copying them to platform directories? → A: No validation - copy files as-is, let platform tools validate their configs
- Q: Should the system create backups before overriding standard files (FR-005)? → A: No backups - override directly (Git provides version history)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Platform-Specific Configuration Management (Priority: P1)

As a developer using agent-ctrl across multiple AI platforms, I want to define platform-specific settings in separate directories so that I can maintain different configurations for claude, cursor, gemini, and other platforms without conflicts.

**Why this priority**: This is the core value proposition - enabling developers to manage platform-specific configurations separately. Without this, all platforms would share the same configuration, causing conflicts and limiting the tool's usefulness.

**Independent Test**: Can be fully tested by creating a settings directory with platform-specific subdirectories, running the apply command for different platforms, and verifying that only the correct platform settings are applied to each target.

**Acceptance Scenarios**:

1. **Given** a project with `settings/claude-code/` and `settings/cursor/` directories, **When** I run `agent-ctrl apply claude`, **Then** only settings from the `settings/claude-code/` directory are applied
2. **Given** a project with no platform-specific settings directory, **When** I run any apply command, **Then** the command succeeds without errors (backward compatibility)
3. **Given** a project with `settings/claude-code/config.json`, **When** I run `agent-ctrl apply claude`, **Then** the platform-specific settings are merged with the standard configuration

---

### User Story 2 - Multi-Platform Configuration Application (Priority: P2)

As a developer working with multiple AI platforms simultaneously, I want the apply command to intelligently handle platform-specific settings so that I can deploy configurations to several platforms in a single operation.

**Why this priority**: This improves developer productivity by supporting batch operations across platforms, which is a common use case for teams working with multiple AI tools.

**Independent Test**: Can be fully tested by creating multiple platform-specific settings directories and running apply commands with multiple platforms, then verifying each platform receives the correct settings.

**Acceptance Scenarios**:

1. **Given** a project with `settings/claude-code/` and `settings/gemini/` directories, **When** I run `agent-ctrl apply claude gemini`, **Then** both platforms receive their respective platform-specific settings
2. **Given** a project with platform-specific settings for only some platforms, **When** I run a multi-platform apply command, **Then** platforms with specific settings get them, while others use standard configuration

---

### User Story 3 - Settings Directory Discovery and Validation (Priority: P3)

As a developer setting up a new project, I want clear feedback about platform-specific settings discovery so that I can understand which settings are being applied and troubleshoot configuration issues.

**Why this priority**: This enhances developer experience and observability, making the tool more maintainable and easier to debug, but the feature works without it.

**Independent Test**: Can be fully tested by creating various platform-specific directory structures and running apply commands with verbose flags to verify proper discovery messages.

**Acceptance Scenarios**:

1. **Given** a project with platform-specific settings directories, **When** I run `agent-ctrl apply claude --verbose`, **Then** I see clear output indicating which platform-specific settings were discovered and applied
2. **Given** a project with an invalid platform identifier in the settings directory, **When** I run an apply command, **Then** I receive a clear warning about the unrecognized platform

---

### Edge Cases

- What happens when the same setting is defined in both standard configuration and platform-specific settings? (Platform-specific file overrides standard file completely)
- How does the system handle missing platform-specific directories for requested platforms? (Gracefully fall back to standard configuration)
- What happens when a platform-specific settings directory exists but is empty? (Apply standard configuration only)
- What happens when platform directory names don't match supported platform names? (System MUST reject with clear error listing valid platforms: antigravity, claude, codex, cursor, forgecode, gemini, kilo, opencode, qwen, windsurf)
- What happens when a settings directory contains invalid configuration files? (Fail with clear error messages indicating the problematic file)
- How does the system handle symbolic links in the settings directory? (Follow them with appropriate warnings for potential security issues)
- What happens when a platform supports a custom config directory via environment variable (CLAUDE_CONFIG_DIR, CODEX_HOME, GEMINI_CONFIG_DIR, OPENCODE_CONFIG_DIR, FORGE_CONFIG)? (System MUST resolve env var before falling back to default path)
- What happens when XDG_CONFIG_HOME is set for kilo or opencode? (System MUST honor XDG path over ~/.config/)
- What happens when copying settings for cursor (global rules live in SQLite, not filesystem)? (System MUST skip cursor global copy and document the limitation)
- What happens when copying settings for both gemini and antigravity in one operation? (System MUST isolate antigravity content to ~/.gemini/antigravity/ subdirectory to avoid polluting gemini top-level)

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST support a new `settings/` subdirectory in the agent-ctrl configuration structure
- **FR-002**: System MUST support individual platform-specific directories under `settings/` for supported platforms only: antigravity, claude, codex, cursor, forgecode, gemini, kilo, opencode, qwen, windsurf (as defined in SupportedApplyPlatform.ts)
- **FR-003**: System MUST apply platform-specific settings when the `apply` command is executed for a specific platform
- **FR-004**: System MUST recursively copy any files and directories (with no depth limit) from platform-specific settings directories exactly as-is to the target platform's configuration directory
- **FR-005**: When the same file exists in both standard configuration and platform-specific settings, the platform-specific file MUST override (replace) the standard file completely
- **FR-006**: System MUST maintain backward compatibility - projects without `settings/` directory must work as before
- **FR-007**: System MUST support case-insensitive platform directory matching (e.g., `Claude-Code` matches `claude-code`)
- **FR-008**: System MUST validate platform-specific configuration files and provide clear error messages
- **FR-009**: System MUST implement path traversal controls and immediately fail with error (stopping all processing) when path traversal violations are detected in platform-specific settings directories
- **FR-010**: System MUST provide discoverability feedback (especially in verbose mode) about which platform-specific settings are being applied

### Key Entities

- **Platform Settings Directory**: Represents the configuration container for a specific AI platform (e.g., `settings/claude/`). Contains platform-specific configuration files that augment or override standard configuration.
- **Standard Configuration**: Represents the base configuration artifacts defined at the project root level (rules/, skills/, agents/, commands/, mcp.json).
- **Configuration Merge**: The process of combining platform-specific settings with standard configuration, where platform-specific settings take precedence in case of conflicts.
- **Platform Identifier**: The canonical name used to identify a supported AI platform (e.g., "claude", "cursor", "gemini").

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Developers can set up platform-specific settings for a new platform in under 5 minutes
- **SC-002**: Apply commands complete within 2 seconds regardless of whether platform-specific settings are present
- **SC-003**: 100% of existing projects without platform-specific settings continue to work without modification
- **SC-004**: Platform-specific settings are correctly applied to target platforms, validated via integration tests where success is defined as correct file copy without errors (99% of test scenarios pass)
- **SC-005**: Developers can identify which platform-specific settings are being applied through command output or documentation
- **SC-006**: Configuration conflicts between standard and platform-specific settings are resolved deterministically with clear precedence rules

## Assumptions

- Platform identifiers follow the existing naming conventions used in agent-ctrl adapters
- Configuration files in platform-specific directories use the same format and structure as standard configuration
- Developers are familiar with the existing agent-ctrl configuration structure
- The `settings/` directory and its contents are optional - not all projects will require platform-specific settings
- Existing platform adapters (Claude, Gemini, Cursor) will be extended to support the new settings discovery logic
- Platform-specific settings will primarily contain configuration files that modify or extend standard configuration behavior

## Dependencies

- Existing agent-ctrl directory structure and adapter architecture
- Platform adapter implementations for Claude Code, Gemini, Cursor, and other supported platforms
- Current configuration validation and error handling infrastructure
- Existing command-line interface and output formatting utilities
