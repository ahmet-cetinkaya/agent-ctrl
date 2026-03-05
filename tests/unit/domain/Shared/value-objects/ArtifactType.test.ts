import { describe, it, expect } from 'bun:test';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('ArtifactType', () => {
  it('should have RULE type', () => {
    expect(String(ArtifactType.RULE)).toBe('rule');
  });

  it('should have SKILL type', () => {
    expect(String(ArtifactType.SKILL)).toBe('skill');
  });

  it('should have AGENT type', () => {
    expect(String(ArtifactType.AGENT)).toBe('agent');
  });
});
