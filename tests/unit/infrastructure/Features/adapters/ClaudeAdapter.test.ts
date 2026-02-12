import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ClaudeAdapter } from '@/infrastructure/features/claude/adapters/ClaudeAdapter';
import { createRule } from '@/core/domain/shared/entities/Rule';
import { createSkill } from '@/core/domain/shared/entities/Skill';
import { createAgent } from '@/core/domain/shared/entities/Agent';

describe('ClaudeAdapter', () => {
  let adapter: ClaudeAdapter;

  beforeEach(() => {
    adapter = new ClaudeAdapter();
  });

  describe('generateConfig', () => {
    it('should generate empty config for empty artifacts', async () => {
      const config = await adapter.generateConfig([]);
      
      expect(config.rules).toEqual([]);
      expect(config.skills).toEqual([]);
      expect(config.agents).toEqual([]);
    });

    it('should map rules correctly', async () => {
      const rule = createRule('my-rule', 'my-rule.md', '/path/to/my-rule.md');
      const config = await adapter.generateConfig([rule]);
      
      expect(config.rules.length).toBe(1);
      expect(config.rules[0].name).toBe('my-rule');
      expect(config.rules[0].path).toBe('/path/to/my-rule.md');
    });

    it('should map skills correctly', async () => {
      const skill = createSkill('my-skill', 'my-skill', '/path/to/my-skill');
      const config = await adapter.generateConfig([skill]);
      
      expect(config.skills.length).toBe(1);
      expect(config.skills[0].name).toBe('my-skill');
      expect(config.skills[0].path).toBe('/path/to/my-skill');
    });

    it('should map agents correctly', async () => {
      const agent = createAgent('my-agent', 'my-agent.md', '/path/to/my-agent.md');
      const config = await adapter.generateConfig([agent]);
      
      expect(config.agents.length).toBe(1);
      expect(config.agents[0].name).toBe('my-agent');
      expect(config.agents[0].path).toBe('/path/to/my-agent.md');
    });
  });

  describe('mergeConfigs', () => {
    it('should return new config when no existing config', () => {
      const newConfig = {
        rules: [{ name: 'rule1', path: '/path1' }],
        skills: [],
        agents: []
      };
      
      const merged = adapter.mergeConfigs(null, newConfig);
      expect(merged.rules.length).toBe(1);
    });

    it('should merge without duplicates', () => {
      const existing = {
        rules: [{ name: 'rule1', path: '/old/path' }],
        skills: [],
        agents: []
      };
      
      const newConfig = {
        rules: [{ name: 'rule1', path: '/new/path' }],
        skills: [],
        agents: []
      };
      
      const merged = adapter.mergeConfigs(existing, newConfig);
      expect(merged.rules.length).toBe(1);
      expect(merged.rules[0].path).toBe('/new/path');
    });
  });
});
