import { describe, it, expect } from 'bun:test';
import { createRule } from '@/core/domain/shared/entities/Rule';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('Rule', () => {
  it('should create a rule with correct properties', () => {
    const rule = createRule('my-rule', 'my-rule.md', '/path/to/my-rule.md');
    
    expect(rule.id).toBe('my-rule');
    expect(rule.filename).toBe('my-rule.md');
    expect(rule.path).toBe('/path/to/my-rule.md');
    expect(rule.type).toBe(ArtifactType.RULE);
  });
});
