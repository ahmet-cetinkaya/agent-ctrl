# Data Model: Platform-Specific Settings Support

**Feature**: Platform-Specific Settings Support  
**Branch**: `006-platform-specific-settings`  
**Date**: 2025-06-29

## Overview

This document defines the data structures, entities, and validation rules for the platform-specific settings feature in agent-ctrl.

## Core Entities

### PlatformSettingsDirectory

**Purpose**: Represents a platform-specific settings directory in the project configuration

**Fields**:

- `platformName`: SupportedApplyPlatform - The canonical platform identifier
- `path`: string - Absolute path to the platform settings directory (e.g., `/project/settings/claude`)
- `exists`: boolean - Whether the directory exists
- `fileCount`: number - Number of files/directories in the settings

**Validation Rules**:

- Platform name must match one of the supported platforms in SupportedApplyPlatform.ts
- Directory must be located within the project's settings/ subdirectory
- Path traversal attempts are rejected (.. components)
- Symbolic links to locations outside project are flagged

**State Transitions**:

```
[discovered] → [validated] → [processed] → [applied]
     ↓            ↓            ↓            ↓
  (scan)      (security)   (copy)      (success/error)
```

### FileOperation

**Purpose**: Represents a file copy operation from source to destination

**Fields**:

- `sourcePath`: string - Absolute path to source file (platform-specific setting)
- `destinationPath`: string - Absolute path to target destination (platform config directory)
- `operationType`: 'file' | 'directory' | 'symlink' - Type of filesystem entity
- `status`: 'pending' | 'completed' | 'failed' | 'skipped' - Operation status
- `overrideAction`: 'replace' | 'preserve' | 'error' - Action when target exists

**Validation Rules**:

- Source path must exist and be readable
- Destination path must be within allowed target directories
- Symbolic links require security validation
- Override action always follows 'replace' semantics per requirements

**Security Constraints**:

- Path traversal validation prevents escaping project boundaries
- Symbolic links outside project boundaries trigger warnings
- File permissions must allow read access
- Destination directories must be writable

### PlatformValidationResult

**Purpose**: Result of platform directory name validation

**Fields**:

- `directoryName`: string - The directory name being validated
- `isValid`: boolean - Whether the name is a valid platform identifier
- `normalizedPlatform`: SupportedApplyPlatform | null - Canonical platform name (case-normalized)
- `validationErrors`: string[] - Any validation error messages

**Validation Rules**:

- Case-insensitive matching against supported platforms
- Must be exact match (no partial matches)
- Empty strings are rejected
- Special characters are rejected (only alphanumeric and hyphens)

## Validation Rules

### Platform Name Validation

```typescript
// Validation logic (simplified)
function validatePlatformName(directoryName: string): PlatformValidationResult {
  const normalized = directoryName.toLowerCase();
  const validPlatforms = SUPPORTED_APPLY_PLATFORMS;

  if (validPlatforms.includes(normalized as SupportedApplyPlatform)) {
    return {
      directoryName,
      isValid: true,
      normalizedPlatform: normalized as SupportedApplyPlatform,
      validationErrors: [],
    };
  }

  return {
    directoryName,
    isValid: false,
    normalizedPlatform: null,
    validationErrors: [
      `Platform '${directoryName}' is not supported. Valid platforms: ${getSupportedApplyPlatformsDisplay()}`,
    ],
  };
}
```

### Path Security Validation

```typescript
// Security validation (simplified)
function validatePathSecurity(filePath: string): SecurityValidationResult {
  const normalized = path.normalize(filePath);
  const resolved = path.resolve(filePath);

  // Check for path traversal attempts
  if (normalized.includes("..")) {
    return { isValid: false, error: "Path traversal not allowed" };
  }

  // Check if path escapes project boundaries
  if (!isWithinProject(resolved)) {
    return { isValid: false, error: "Path outside project boundaries" };
  }

  return { isValid: true, error: null };
}
```

## File System Operations

### Copy Semantics

**Override Behavior**: Platform-specific files completely replace standard files

- No content merging
- No backup creation (unless specified by platform adapter)
- Deterministic replacement: source → destination

**Directory Operations**:

- Recursive directory copying
- Preserves file permissions and structure
- Creates target directories if needed
- Follows symbolic links with security warnings

**Error Isolation**:

- Individual file failures don't stop entire operation
- Errors are collected and reported at end
- Successful operations continue despite individual failures

## Type Definitions

### Core Types

```typescript
type PlatformOperationStatus = "pending" | "completed" | "failed" | "skipped";
type OverrideAction = "replace" | "preserve" | "error";
type FileSystemEntityType = "file" | "directory" | "symlink";

interface PlatformSettingsDirectory {
  platformName: SupportedApplyPlatform;
  path: string;
  exists: boolean;
  fileCount: number;
}

interface FileOperation {
  sourcePath: string;
  destinationPath: string;
  operationType: FileSystemEntityType;
  status: PlatformOperationStatus;
  overrideAction: OverrideAction;
  error?: string;
}

interface PlatformValidationResult {
  directoryName: string;
  isValid: boolean;
  normalizedPlatform: SupportedApplyPlatform | null;
  validationErrors: string[];
}

interface SecurityValidationResult {
  isValid: boolean;
  error: string | null;
  warnings: string[];
}

interface PlatformConfigPath {
  platform: SupportedApplyPlatform;
  resolvedPath: string;
  resolvedVia: "env_var" | "xdg" | "default";
  envVarUsed: string | null;
  supportsGlobalCopy: boolean;
}
```

### Platform Config Path Resolution

The `PlatformConfigPath` entity resolves the **destination** directory for each platform. See [platform-paths.md](./platform-paths.md) for the verified path mapping and environment variable resolution rules.

**Key constraints**:

- Five platforms support environment variable overrides (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GEMINI_CONFIG_DIR`, `OPENCODE_CONFIG_DIR`, `FORGE_CONFIG`) — MUST be resolved before falling back to defaults
- `kilo` and `opencode` follow XDG spec — check `$XDG_CONFIG_HOME` first
- `cursor` has NO filesystem-based global config (rules live in SQLite) — `supportsGlobalCopy = false`
- `antigravity` shares `~/.gemini/` root with `gemini`, isolated under `antigravity/` subdirectory

## Relationships

### Entity Relationships

```
PlatformSettingsDirectory (1) → (*) FileOperation
  ├── contains multiple files/directories to copy
  └── each file has independent status

PlatformValidationResult (1) → (1) PlatformSettingsDirectory
  ├── validation must pass before processing
  └── provides canonical platform name

SecurityValidationResult (1) → (1) FileOperation
  ├── each file operation requires security validation
  └── blocks operation if validation fails
```

## Constraints and Invariants

### Invariants

1. **Platform Uniqueness**: Only one settings directory per supported platform
2. **Override Completeness**: Platform files always completely replace standard files
3. **Path Security**: No operation can escape project boundaries
4. **Validation First**: Platform validation must pass before any file operations
5. **Atomic Operations**: Each file operation is independent with isolated error handling

### Business Rules

1. **Backward Compatibility**: Projects without settings/ directory work unchanged
2. **Platform Validation**: Only supported platform names are accepted
3. **Security First**: Path traversal and symbolic link security always enforced
4. **Clear Feedback**: All operations provide discoverable status information
5. **Error Isolation**: Individual file failures don't prevent other operations

## Data Flow

```
[User runs apply command]
        ↓
[Discover settings/ directory]
        ↓
[Validate platform directory names]
        ↓
[Security validation of file paths]
        ↓
[Copy files to platform config]
        ↓
[Provide operation feedback]
```

This data model supports all functional requirements while maintaining security, performance, and backward compatibility constraints defined in the specification.
