import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { PathSecurity } from '@/infrastructure/shared/utils/PathSecurity';

describe('PathSecurity', () => {
  const projectRoot = '/home/user/project';
  let security: PathSecurity;

  beforeEach(() => {
    security = new PathSecurity(projectRoot);
  });

  describe('isWithinProject', () => {
    it('should return true for paths within project', () => {
      expect(security.isWithinProject('/home/user/project/rules')).toBe(true);
      expect(security.isWithinProject('/home/user/project/skills/test')).toBe(true);
    });

    it('should return false for paths outside project', () => {
      expect(security.isWithinProject('/home/user/other')).toBe(false);
      expect(security.isWithinProject('/etc/passwd')).toBe(false);
    });
  });

  describe('sanitizePath', () => {
    it('should remove null bytes', () => {
      const sanitized = security.sanitizePath('file\0name');
      expect(sanitized).toBe('filename');
    });

    it('should throw on path traversal attempts', () => {
      expect(() => {
        security.sanitizePath('../../../etc/passwd');
      }).toThrow('Path traversal attempt detected');
    });

    it('should normalize valid parent directory references', () => {
      const sanitized = security.sanitizePath('rules/../agents/my-agent.md');
      expect(sanitized).toBe('agents/my-agent.md');
    });
  });

  describe('hasSpecialCharacters', () => {
    it('should detect special characters', () => {
      expect(security.hasSpecialCharacters('file<name')).toBe(true);
      expect(security.hasSpecialCharacters('file>name')).toBe(true);
      expect(security.hasSpecialCharacters('file:name')).toBe(true);
      expect(security.hasSpecialCharacters('file"name')).toBe(true);
    });

    it('should return false for valid paths', () => {
      expect(security.hasSpecialCharacters('valid-path_name.txt')).toBe(false);
    });
  });
});
