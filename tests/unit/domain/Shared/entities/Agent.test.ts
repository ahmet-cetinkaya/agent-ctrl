import { describe, it, expect } from 'bun:test';
import { createAgent } from '../../../../../src/core/domain/shared/entities/Agent';
import { ArtifactType } from '../../../../../src/core/domain/shared/value-objects/ArtifactType';

describe('Agent', () => {
  it('should create an agent with correct properties', () => {
    const agent = createAgent('my-agent', 'my-agent.md', '/path/to/my-agent.md');
    
    expect(agent.id).toBe('my-agent');
    expect(agent.filename).toBe('my-agent.md');
    expect(agent.path).toBe('/path/to/my-agent.md');
    expect(agent.type).toBe(ArtifactType.AGENT);
  });
});
