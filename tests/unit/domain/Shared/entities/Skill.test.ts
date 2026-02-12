import { describe, it, expect } from 'bun:test';
import { createSkill } from '@/core/domain/shared/entities/Skill';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('Skill', () => {
  it('should create a skill with correct properties', () => {
    const skill = createSkill('my-skill', 'my-skill', '/path/to/my-skill');
    
    expect(skill.id).toBe('my-skill');
    expect(skill.directoryName).toBe('my-skill');
    expect(skill.path).toBe('/path/to/my-skill');
    expect(skill.type).toBe(ArtifactType.SKILL);
  });
});
