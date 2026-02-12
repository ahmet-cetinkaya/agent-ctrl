import { describe, it, expect } from 'bun:test';
import { ArtifactType } from '../../../../../src/core/domain/shared/value-objects/ArtifactType';

describe('ArtifactType', () => {
  it('should have RULE type', () => {
    expect(ArtifactType.RULE).toBe('rule');
  });

  it('should have SKILL type', () => {
    expect(ArtifactType.SKILL).toBe('skill');
  });

  it('should have AGENT type', () => {
    expect(ArtifactType.AGENT).toBe('agent');
  });
});
