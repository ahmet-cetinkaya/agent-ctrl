import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PathResolver } from '@/infrastructure/shared/utils/PathResolver';

describe('PathResolver', () => {
  const projectRoot = '/home/user/project';
  let resolver: PathResolver;

  beforeEach(() => {
    resolver = new PathResolver(projectRoot);
  });

  describe('constructor', () => {
    it('should initialize with project root', () => {
      expect(resolver.getProjectRoot()).toBe(projectRoot);
    });

    it('should create path security instance', () => {
      expect(resolver).toBeDefined();
    });
  });

  describe('resolve', () => {
    it('should resolve relative paths to absolute', () => {
      const result = resolver.resolve('rules/my-rule.md');
      expect(result).toBe(projectRoot + '/rules/my-rule.md');
    });

    it('should resolve absolute paths', () => {
      const absolutePath = projectRoot + '/rules/my-rule.md';
      const result = resolver.resolve(absolutePath);
      expect(result).toBe(absolutePath);
    });

    it('should resolve dot segments', () => {
      const result = resolver.resolve('./rules/my-rule.md');
      expect(result).toBe(projectRoot + '/rules/my-rule.md');
    });

    it('should resolve parent directory segments', () => {
      const result = resolver.resolve('rules/../agents/my-agent.md');
      expect(result).toBe(projectRoot + '/agents/my-agent.md');
    });

    it('should throw on path traversal attempts', () => {
      expect(() => {
        resolver.resolve('../../../etc/passwd');
      }).toThrow();
    });

    it('should validate resolved path is within project', () => {
      expect(() => {
        resolver.resolve('/outside/project/path');
      }).toThrow();
    });
  });

  describe('isWithinProject', () => {
    it('should return true for paths within project', () => {
      expect(resolver.isWithinProject(projectRoot + '/rules')).toBe(true);
      expect(resolver.isWithinProject(projectRoot + '/skills/my-skill')).toBe(true);
      expect(resolver.isWithinProject(projectRoot + '/agents/my-agent.md')).toBe(true);
    });

    it('should return true for project root', () => {
      expect(resolver.isWithinProject(projectRoot)).toBe(true);
    });

    it('should return false for paths outside project', () => {
      expect(resolver.isWithinProject('/home/user/other')).toBe(false);
      expect(resolver.isWithinProject('/etc/passwd')).toBe(false);
      expect(resolver.isWithinProject('/tmp')).toBe(false);
    });

    it('should return false for parent directory traversal', () => {
      const parentDir = projectRoot + '/../';
      expect(resolver.isWithinProject(parentDir)).toBe(false);
    });

    it('should handle relative paths', () => {
      expect(resolver.isWithinProject('rules')).toBe(true);
      expect(resolver.isWithinProject('../other')).toBe(false);
    });
  });

  describe('getProjectRoot', () => {
    it('should return the absolute project root path', () => {
      const result = resolver.getProjectRoot();
      expect(result).toBe(projectRoot);
    });
  });

  describe('getRulesPath', () => {
    it('should return correct rules directory path', () => {
      const result = resolver.getRulesPath();
      expect(result).toBe(projectRoot + '/rules');
    });
  });

  describe('getSkillsPath', () => {
    it('should return correct skills directory path', () => {
      const result = resolver.getSkillsPath();
      expect(result).toBe(projectRoot + '/skills');
    });
  });

  describe('getAgentsPath', () => {
    it('should return correct agents directory path', () => {
      const result = resolver.getAgentsPath();
      expect(result).toBe(projectRoot + '/agents');
    });
  });

  describe('getCommandsPath', () => {
    it('should return correct commands directory path', () => {
      const result = resolver.getCommandsPath();
      expect(result).toBe(projectRoot + '/commands');
    });
  });

  describe('consistency', () => {
    it('should maintain consistent path separation across getters', () => {
      const rulesPath = resolver.getRulesPath();
      const skillsPath = resolver.getSkillsPath();
      const agentsPath = resolver.getAgentsPath();
      const commandsPath = resolver.getCommandsPath();

      expect(rulesPath).toContain('rules');
      expect(skillsPath).toContain('skills');
      expect(agentsPath).toContain('agents');
      expect(commandsPath).toContain('commands');

      expect(rulesPath).toMatch(new RegExp(`^${projectRoot}`));
      expect(skillsPath).toMatch(new RegExp(`^${projectRoot}`));
      expect(agentsPath).toMatch(new RegExp(`^${projectRoot}`));
      expect(commandsPath).toMatch(new RegExp(`^${projectRoot}`));
    });
  });
});
