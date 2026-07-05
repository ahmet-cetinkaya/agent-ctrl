# File Operations Contract

**Purpose**: Defines the contract for secure file copying operations in platform-specific settings

**Version**: 1.0.0  
**Feature**: Platform-Specific Settings Support

## Interface Definition

### Input Parameters

```typescript
interface FileOperationInput {
  sourcePath: string;
  destinationPath: string;
  operationType: "file" | "directory" | "symlink";
  overrideBehavior: "replace" | "preserve" | "error";
}
```

### Output Contract

```typescript
interface FileOperationOutput {
  success: boolean;
  operationStatus: "completed" | "failed" | "skipped";
  filesProcessed: number;
  errors: FileOperationError[];
  warnings: string[];
}
```

## Behavioral Contract

### Core Operations

1. **File Copy Operation**
   - **Input**: Source file path, destination path
   - **Behavior**: Copy file exactly as-is to destination
   - **Override**: Replace destination file if exists
   - **Output**: `{ success: true, operationStatus: 'completed', filesProcessed: 1 }`

2. **Directory Copy Operation**
   - **Input**: Source directory path, destination path
   - **Behavior**: Recursively copy directory contents
   - **Override**: Replace destination files/directories if exists
   - **Output**: `{ success: true, operationStatus: 'completed', filesProcessed: N }`

3. **Security Validation**
   - **Path Traversal**: Reject paths containing `..` components
   - **Boundary Check**: Ensure paths stay within project directory
   - **Symbolic Links**: Detect and warn for symbolic links

### Error Handling

1. **Permission Errors**
   - Source file not readable → `failed` with error details
   - Destination not writable → `failed` with error details
   - Continue processing other files

2. **Security Violations**
   - Path traversal detected → `failed` immediately
   - Symbolic link outside project → `completed` with warning
   - Invalid target directory → `failed` with error details

3. **File System Errors**
   - Source file missing → `skipped` with warning
   - Disk space issues → `failed` with error details
   - Operation interrupted → `failed` with error details

## Security Contract

### Path Traversal Prevention

```typescript
interface SecurityValidation {
  validatePath(path: string): SecurityResult;
}

interface SecurityResult {
  allowed: boolean;
  normalizedPath: string;
  securityIssue: string | null;
}
```

**Rules**:

- Reject paths containing `..` components
- Normalize all paths before operations
- Verify paths are within project boundaries
- Reject absolute paths outside allowed directories

### Symbolic Link Handling

```typescript
interface SymlinkResult {
  isSymlink: boolean;
  targetPath: string | null;
  securityRisk: boolean;
  warning: string | null;
}
```

**Rules**:

- Detect symbolic links before copying
- Validate symbolic link targets
- Warn if target points outside project
- Allow with warning if target is safe

## Performance Contract

### Timing Constraints

- **Single file operation**: < 100ms for typical file sizes
- **Directory operation**: < 2 seconds for typical project structures
- **Validation**: < 50ms per path validation operation
- **Total apply command**: < 2 seconds (SC-002 requirement)

### Scalability Constraints

- Support any number of files per platform
- Handle deeply nested directory structures
- Process files up to platform-specific size limits
- Maintain performance as project grows

## Examples

### Successful File Copy

```typescript
copyFile({
  sourcePath: "/project/settings/claude/rules/coding-style.md",
  destinationPath: "~/.claude/rules/coding-style.md",
  operationType: "file",
  overrideBehavior: "replace",
});
// → { success: true, operationStatus: 'completed', filesProcessed: 1 }
```

### Security Violation

```typescript
copyFile({
  sourcePath: "/project/settings/claude/../../../etc/passwd",
  destinationPath: "~/.claude/passwd",
  operationType: "file",
  overrideBehavior: "replace",
});
// → { success: false, operationStatus: 'failed', errors: [{ code: 'PATH_TRAVERSAL', message: 'Path traversal not allowed' }] }
```

### Symbolic Link Warning

```typescript
copyFile({
  sourcePath: "/project/settings/claude/config → /external/config",
  destinationPath: "~/.claude/config",
  operationType: "symlink",
  overrideBehavior: "replace",
});
// → { success: true, operationStatus: 'completed', warnings: ['Symbolic link points outside project boundaries'] }
```

## Implementation Notes

- All file operations must be atomic where possible
- Error isolation prevents single file failures from stopping entire operation
- Progress reporting for operations involving multiple files
- Integration with existing filesystem utilities in Node.js
- Must maintain backward compatibility with projects without settings
