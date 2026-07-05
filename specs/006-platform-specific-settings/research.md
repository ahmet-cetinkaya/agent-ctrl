# Research: Platform-Specific Settings Support

**Feature**: Platform-Specific Settings Support  
**Branch**: `006-platform-specific-settings`  
**Date**: 2025-06-29

## Overview

This document consolidates research findings for implementing platform-specific settings support in agent-ctrl. Since the Technical Context in the plan was fully specified with no unresolved clarifications, this research document summarizes the key technical decisions and best practices that inform the implementation.

## Key Technical Decisions

### 1. Filesystem Security Architecture

**Decision**: Implement centralized file operations in `core/filestore/` module with path traversal validation and symbolic link handling.

**Rationale**:

- Maintains security by isolating file operations in a single module
- Follows the principle of least surprise for developers
- Aligns with Node.js security best practices for filesystem operations
- Path traversal attacks are a common vulnerability in file operations

**Alternatives Considered**:

- Direct filesystem operations in adapters: Rejected due to security risks and code duplication
- Third-party file validation libraries: Rejected to minimize dependencies and maintain control

### 2. Platform Name Validation Strategy

**Decision**: Validate platform names against the canonical list in `SupportedApplyPlatform.ts` with case-insensitive matching.

**Rationale**:

- Ensures consistency across the codebase
- Prevents typos and unsupported platform names
- Case-insensitive matching improves developer experience
- Single source of truth for supported platforms

**Alternatives Considered**:

- Runtime platform discovery: Rejected due to complexity and potential security issues
- Allow any platform name: Rejected due to validation requirements from clarifications

### 3. Configuration Override Semantics

**Decision**: Platform-specific files completely override (replace) standard files rather than merging content.

**Rationale**:

- Simpler mental model for developers
- More predictable behavior
- Easier to debug and understand
- Aligns with user expectations from clarification

**Alternatives Considered**:

- Content merging: Rejected due to complexity and potential conflicts
- Parallel file existence: Rejected due to unclear precedence rules

### 4. File Copy Strategy

**Decision**: Copy any files and directories exactly as-is from platform-specific settings to target platform config directory.

**Rationale**:

- Maximum flexibility for developers
- Supports any file type or structure
- Simple, transparent operation
- Aligns with "exactly as-is" requirement from clarifications

**Alternatives Considered**:

- Restrict to specific file types: Rejected due to flexibility requirements
- Transform or process files: Rejected due to complexity requirements

## Best Practices Integration

### Node.js Filesystem Security

- Implement path traversal validation using `path.normalize()` and checking for `..` components
- Use absolute paths for all operations to prevent ambiguity
- Validate symbolic links before following them
- Provide clear warnings for potential security issues

### TypeScript Type Safety

- Define strict types for platform identifiers and settings structures
- Use Zod schemas for runtime validation
- Leverage TypeScript's strict mode for compile-time safety
- Maintain type discipline across module boundaries

### CLI User Experience

- Provide clear, actionable error messages
- Support verbose mode for detailed operation feedback
- Maintain backward compatibility for existing workflows
- Follow existing CLI patterns in agent-ctrl

## Performance Considerations

### File Operation Optimization

- Batch file operations where possible
- Use asynchronous filesystem operations to prevent blocking
- Implement progress feedback for operations involving many files
- Cache validation results where appropriate

### Scalability Expectations

- Support up to 11 platforms (as defined in SupportedApplyPlatform.ts)
- Handle any number of files per platform (reasonable limits)
- Complete apply operations within 2 seconds (SC-002)
- Maintain performance as project size grows

## Security Validation

### Path Traversal Prevention

- Validate all file paths before operations
- Reject paths containing `..` components that escape intended directories
- Use `path.resolve()` and `path.normalize()` consistently
- Implement allow-list validation for target directories

### Symbolic Link Handling

- Detect symbolic links before copying
- Issue warnings for symbolic links pointing outside project boundaries
- Follow symbolic links only with explicit user acknowledgment
- Log all symbolic link operations for audit trails

## Integration Points

### Existing Adapter Architecture

- Extend existing adapters to use settings discovery
- Maintain adapter interface contracts
- Preserve existing adapter behavior for projects without settings
- Update adapters to handle platform-specific file overrides

### Configuration Scanner

- Extend configuration scanner to discover settings/ directory
- Maintain existing scanning behavior for backward compatibility
- Add platform-specific settings discovery to scanning workflow
- Validate discovered settings before integration

### Error Handling Infrastructure

- Extend existing error handling for settings-specific failures
- Maintain consistent error messaging patterns
- Provide actionable error messages for validation failures
- Isolate settings-specific errors from other configuration errors

## Testing Strategy

### Unit Testing

- Test file operations with various file types and structures
- Validate path traversal protection mechanisms
- Test platform name validation logic
- Test symbolic link detection and handling

### Integration Testing

- Test end-to-end apply workflows with platform-specific settings
- Validate interactions between settings and standard configuration
- Test error handling and recovery scenarios
- Validate backward compatibility scenarios

### Contract Testing

- Define expected behavior for file operations
- Test platform validation contracts
- Validate override semantics
- Test security constraint enforcement

## Next Steps

This research informs Phase 1 design artifacts:

1. **data-model.md**: Entity definitions for settings structures, validation rules, and file operations
2. **contracts/**: Interface contracts for file operations, platform validation, and error handling
3. **quickstart.md**: Runnable validation scenarios proving the feature works end-to-end

All technical decisions align with the constitution requirements and support the feature's success criteria.
