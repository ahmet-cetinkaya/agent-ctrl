# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-05-08

### Added

- Implement artifact cleanup for all platforms
- Implement agent rendering and artifact reporting
- Add ForgeCode platform support

### Fixed

- Enable artifact cleanup during apply

## [0.2.0] - 2026-05-07

### Added

- Overhaul visual presentation and interactive experience

## [0.1.7] - 2026-04-21

### Fixed

- Support dual config directories for kilo vscode and cli

## [0.1.6] - 2026-04-05

### Changed

- Map commands to skills for Codex instead of using deprecated custom prompts
- Add agent support for Codex, syncing agents as TOML files to `.codex/agents/`

## [0.1.5] - 2026-03-27

### Fixed

- Use markdown for command sync and rename MCP config on kilo platform

## [0.1.4] - 2026-03-20

### Fixed

- Add specific error handling for skill resolution failures
- Add detailed skill resolution errors

## [0.1.3] - 2026-03-12

### Changed

- Internal improvements and maintenance

## [0.1.2] - 2026-03-12

### Fixed

- Flatten directory structure for codex prompts using ':' separator

## [0.1.1] - 2026-03-11

### Changed

- Internal improvements and maintenance

## [0.1.0] - 2026-03-10

### Added

- Implement SkillsMP and Smithery catalog sync with CLI integration
- Add command and mcp ls subcommands with global path support
- Add default global config path support using ~/.agent-ctrl
- Add project scope and custom user config root support
- Implement multi-platform apply integration across 8 targets
- Implement dynamic MCP configuration management
- Rename force to override and add artifact cleaning capability
- Implement core application architecture and CLI foundation

### Changed

- Add IAgentScanner interface for dependency injection

### Fixed

- Add env variable placeholder resolution and filtering for MCP servers
- Use config root as default path for apply command
- Address all PR review issues from comprehensive review
- Use Commander.js Option API for option conflict handling
- Improve error handling and add resilience tests
- Implement platform-native configuration sync with multi-artifact support
- Consolidate Claude config to CLAUDE.md format and remove internal state
- Add claude platform support for apply feature
- Redact sensitive env vars in mcp ls --json
- Validate symlinks stay within project root
- Add path validation to init command
- Prevent path traversal with trailing dot patterns
- Correct codex scope resolution for trusted projects
- Address PR review issues - error handling, types, and tests
- Address all PR review issues
- Address PR review comments - security, architecture, and style
- Address code review findings for error handling and documentation
- Align apply output with global Claude layout
- Add missing imports to CLI index
- Add getGlobalOptions import and fix commander usage
- Correct import paths in presentation layer
- Patch path traversal and command injection vulnerabilities

[unreleased]: https://github.com/ahmet-cetinkaya/agent-ctrl/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.3.0
[0.2.0]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.2.0
[0.1.7]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.7
[0.1.6]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.6
[0.1.5]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.5
[0.1.4]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.4
[0.1.3]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.3
[0.1.2]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.2
[0.1.1]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.1
[0.1.0]: https://github.com/ahmet-cetinkaya/agent-ctrl/releases/tag/v0.1.0
