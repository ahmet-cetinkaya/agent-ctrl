# Quickstart Validation Guide: Platform-Specific Settings Support

**Purpose**: Runnable validation scenarios to prove platform-specific settings feature works end-to-end

**Feature**: Platform-Specific Settings Support  
**Branch**: `006-platform-specific-settings`

## Prerequisites

- agent-ctrl CLI installed and configured
- Project initialized with standard agent-ctrl structure
- Supported platform available (e.g., Claude Code, Cursor)

## Validation Scenarios

### Scenario 1: Basic Platform-Specific Settings (P1)

**Objective**: Verify platform-specific settings are applied correctly

**Setup Commands**:

```bash
# Create test project
mkdir -p test-platform-settings && cd test-platform-settings
agent-ctrl init

# Create platform-specific settings
mkdir -p settings/claude
echo "claude-specific-rule" > settings/claude/custom-rule.md

# Run apply command
agent-ctrl apply claude
```

**Expected Outcomes**:

- ✅ Command completes successfully (within 2 seconds)
- ✅ Custom rule is copied to Claude Code config directory
- ✅ Success message indicates platform-specific settings were discovered
- ✅ No errors or warnings about invalid platforms

**Validation Commands**:

```bash
# Verify file was copied
ls ~/.claude/rules/custom-rule.md

# Run apply again to test override behavior
echo "updated-rule" > settings/claude/custom-rule.md
agent-ctrl apply claude
cat ~/.claude/rules/custom-rule.md  # Should contain "updated-rule"
```

### Scenario 2: Backward Compatibility (P1)

**Objective**: Verify projects without settings directory work unchanged

**Setup Commands**:

```bash
# Create test project without settings directory
mkdir -p test-no-settings && cd test-no-settings
agent-ctrl init

# Create standard rules only
mkdir -p rules
echo "standard-rule" > rules/coding-style.md

# Run apply command
agent-ctrl apply claude
```

**Expected Outcomes**:

- ✅ Command completes successfully (100% backward compatibility)
- ✅ Standard rules are processed normally
- ✅ No errors about missing settings directory
- ✅ Same behavior as before platform-specific settings feature

### Scenario 3: Multi-Platform Application (P2)

**Objective**: Verify different platform settings are applied correctly

**Setup Commands**:

```bash
# Create test project with multiple platforms
mkdir -p test-multi-platform && cd test-multi-platform
agent-ctrl init

# Create platform-specific settings
mkdir -p settings/claude settings/cursor
echo "claude-only" > settings/claude/platform-config.md
echo "cursor-only" > settings/cursor/platform-config.md

# Apply to multiple platforms
agent-ctrl apply claude cursor
```

**Expected Outcomes**:

- ✅ Both platforms receive their respective settings
- ✅ Claude config contains "claude-only"
- ✅ Cursor config contains "cursor-only"
- ✅ Clear feedback about which platforms received settings

**Validation Commands**:

```bash
# Verify each platform got correct settings
# (platform-specific paths vary by platform)
```

### Scenario 4: Platform Name Validation (P3)

**Objective**: Verify invalid platform names are rejected

**Setup Commands**:

```bash
# Create test project
mkdir -p test-validation && cd test-validation
agent-ctrl init

# Create invalid platform directory
mkdir -p settings/invalid-platform
echo "test" > settings/invalid-platform/config.md

# Run apply command
agent-ctrl apply claude
```

**Expected Outcomes**:

- ✅ Command succeeds (invalid directories are skipped)
- ✅ Warning message about unsupported platform
- ✅ List of valid platforms provided in warning
- ✅ Standard settings applied normally

### Scenario 5: Security Validation (P3)

**Objective**: Verify security controls work correctly

**Setup Commands**:

```bash
# Create test project
mkdir -p test-security && cd test-security
agent-ctrl init

# Attempt path traversal (should be blocked)
mkdir -p "settings/claude/../../../etc"
echo "malicious" > "settings/claude/../../../etc/passwd"

# Run apply command
agent-ctrl apply claude
```

**Expected Outcomes**:

- ✅ Path traversal attempt is blocked
- ✅ Clear error message about security violation
- ✅ No files copied outside project boundaries
- ✅ Command fails safely without data corruption

### Scenario 6: File Override Behavior (P1)

**Objective**: Verify platform files completely override standard files

**Setup Commands**:

```bash
# Create test project
mkdir -p test-override && cd test-override
agent-ctrl init

# Create same file in standard and platform-specific locations
mkdir -p rules settings/claude
echo "standard-content" > rules/shared-config.md
echo "platform-content" > settings/claude/shared-config.md

# Apply platform settings
agent-ctrl apply claude
```

**Expected Outcomes**:

- ✅ Platform file completely replaces standard file
- ✅ Final config contains "platform-content" only
- ✅ No merging or partial content combination
- ✅ Clear override behavior in apply output

**Validation Commands**:

```bash
# Verify final content
# (check platform config directory for "platform-content")
```

## Troubleshooting

### Common Issues

**Issue**: Platform name validation fails

- **Solution**: Ensure directory name matches supported platforms exactly
- **Check**: Run `agent-ctrl apply --verbose` for detailed validation feedback

**Issue**: Files not being copied

- **Solution**: Verify file permissions and paths are accessible
- **Check**: Use `--verbose` flag to see detailed operation logs

**Issue**: Performance degradation

- **Solution**: Check for excessively large files or deep directory structures
- **Check**: Monitor file counts and sizes in platform-specific directories

### Debug Mode

Enable verbose output for detailed operation information:

```bash
agent-ctrl apply claude --verbose
```

## Success Criteria Validation

Use these scenarios to validate the feature's success criteria:

- **SC-001**: Developers can set up platform-specific settings in under 5 minutes ✅
- **SC-002**: Apply commands complete within 2 seconds ✅
- **SC-003**: 100% backward compatibility maintained ✅
- **SC-004**: Platform-specific settings correctly applied ✅
- **SC-005**: Clear discoverability feedback provided ✅
- **SC-006**: Deterministic conflict resolution ✅

## Next Steps

After validating these scenarios:

1. Run contract tests: `bun test tests/contract/settings-application/`
2. Verify integration tests pass
3. Check type validation: `bun run type-check`
4. Review test coverage reports

This quickstart provides comprehensive validation that the platform-specific settings feature meets all requirements and works correctly across real-world usage scenarios.
