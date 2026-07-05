# Platform Validation Contract

**Purpose**: Defines the contract for validating platform-specific settings directories and names

**Version**: 1.0.0  
**Feature**: Platform-Specific Settings Support

## Interface Definition

### Input Parameters

```typescript
interface PlatformValidationInput {
  directoryName: string;
  projectRoot: string;
  settingsPath: string;
}
```

### Output Contract

```typescript
interface PlatformValidationOutput {
  isValid: boolean;
  platform: SupportedApplyPlatform | null;
  errors: string[];
  warnings: string[];
}
```

## Behavioral Contract

### Validation Rules

1. **Case-Insensitive Matching**
   - Input: `directoryName: "Claude-Code"`
   - Output: `{ isValid: true, platform: "claude" }`

2. **Invalid Platform Name**
   - Input: `directoryName: "invalid-platform"`
   - Output: `{ isValid: false, platform: null, errors: ["Platform 'invalid-platform' is not supported. Valid platforms: antigravity, claude, codex, cursor, forgecode, gemini, kilo, opencode, qwen, windsurf"] }`

3. **Empty String**
   - Input: `directoryName: ""`
   - Output: `{ isValid: false, platform: null, errors: ["Platform name cannot be empty"] }`

4. **Special Characters**
   - Input: `directoryName: "claude/code"`
   - Output: `{ isValid: false, platform: null, errors: ["Platform name contains invalid characters"] }`

### Success Criteria

- ✅ Returns valid platform identifier for all supported platforms (case-insensitive)
- ✅ Returns descriptive error messages for unsupported platforms
- ✅ Lists all valid platform names in error messages
- ✅ Handles edge cases (empty strings, special characters, path traversal attempts)

## Examples

### Valid Platform Names

```typescript
// Case variations
validatePlatformName("claude"); // → { isValid: true, platform: "claude" }
validatePlatformName("CLAUDE"); // → { isValid: true, platform: "claude" }
validatePlatformName("Claude"); // → { isValid: true, platform: "claude" }

// All supported platforms
validatePlatformName("cursor"); // → { isValid: true, platform: "cursor" }
validatePlatformName("gemini"); // → { isValid: true, platform: "gemini" }
validatePlatformName("antigravity"); // → { isValid: true, platform: "antigravity" }
```

### Invalid Platform Names

```typescript
// Not in supported list
validatePlatformName("unknown-platform"); // → { isValid: false, errors: ["Platform 'unknown-platform' is not supported..."] }

// Invalid format
validatePlatformName("claude/code"); // → { isValid: false, errors: ["Invalid characters"] }
validatePlatformName(""); // → { isValid: false, errors: ["Cannot be empty"] }
validatePlatformName("../escape"); // → { isValid: false, errors: ["Path traversal detected"] }
```

## Implementation Notes

- Must reference SupportedApplyPlatform.ts for canonical platform list
- Validation must be case-insensitive for developer experience
- Error messages must list all valid platforms for user guidance
- Must integrate with existing configuration scanner architecture
