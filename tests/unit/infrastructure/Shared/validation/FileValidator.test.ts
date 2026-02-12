import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { FileValidator } from '@/infrastructure/shared/validation/FileValidator';
import { writeFile, mkdir, rm, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('FileValidator', () => {
  let validator: FileValidator;
  let testDir: string;

  beforeEach(async () => {
    validator = new FileValidator();
    testDir = resolve(tmpdir(), `file-validator-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('hasExtension', () => {
    it('should return true for valid markdown extensions', () => {
      expect(validator.hasExtension('file.md', ['.md', '.markdown'])).toBe(true);
      expect(validator.hasExtension('file.markdown', ['.md', '.markdown'])).toBe(true);
    });

    it('should return false for invalid extensions', () => {
      expect(validator.hasExtension('file.txt', ['.md', '.markdown'])).toBe(false);
      expect(validator.hasExtension('file', ['.md', '.markdown'])).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(validator.hasExtension('file.MD', ['.md'])).toBe(true);
      expect(validator.hasExtension('file.MarkDown', ['.markdown'])).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const filePath = resolve(testDir, 'test.txt');
      await writeFile(filePath, 'content');
      
      const result = await validator.exists(filePath);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(true);
      }
    });

    it('should return false for non-existing file', async () => {
      const result = await validator.exists(resolve(testDir, 'nonexistent.txt'));
      expect(result.success).toBe(false);
    });

    it('should return true for existing directory', async () => {
      const dirPath = resolve(testDir, 'subdir');
      await mkdir(dirPath, { recursive: true });
      
      const result = await validator.exists(dirPath);
      expect(result.success).toBe(true);
    });

    it('should return error with descriptive message', async () => {
      const result = await validator.exists('/nonexistent/path');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('does not exist');
      }
    });
  });

  describe('isReadable', () => {
    it('should return true for readable file', async () => {
      const filePath = resolve(testDir, 'readable.txt');
      await writeFile(filePath, 'content');
      
      const result = await validator.isReadable(filePath);
      expect(result.success).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      const result = await validator.isReadable(resolve(testDir, 'nonexistent.txt'));
      expect(result.success).toBe(false);
    });

    it('should return false for unreadable file', async () => {
      const filePath = resolve(testDir, 'unreadable.txt');
      await writeFile(filePath, 'content');
      await chmod(filePath, 0o000);
      
      const result = await validator.isReadable(filePath);
      expect(result.success).toBe(false);
    });

    it('should return error with descriptive message', async () => {
      const result = await validator.isReadable('/nonexistent/path');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not readable');
      }
    });
  });

  describe('validateMarkdownFile', () => {
    it('should validate valid markdown file', async () => {
      const filePath = resolve(testDir, 'valid.md');
      await writeFile(filePath, '# Valid');
      
      const result = await validator.validateMarkdownFile(filePath);
      expect(result.success).toBe(true);
    });

    it('should reject invalid extension', async () => {
      const filePath = resolve(testDir, 'invalid.txt');
      await writeFile(filePath, 'content');
      
      const result = await validator.validateMarkdownFile(filePath);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Invalid extension');
      }
    });

    it('should reject non-existing file', async () => {
      const result = await validator.validateMarkdownFile(resolve(testDir, 'nonexistent.md'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('does not exist');
      }
    });

    it('should reject unreadable file', async () => {
      const filePath = resolve(testDir, 'unreadable.md');
      await writeFile(filePath, 'content');
      await chmod(filePath, 0o000);
      
      const result = await validator.validateMarkdownFile(filePath);
      expect(result.success).toBe(false);
    });

    it('should accept .markdown extension', async () => {
      const filePath = resolve(testDir, 'valid.markdown');
      await writeFile(filePath, '# Valid');
      
      const result = await validator.validateMarkdownFile(filePath);
      expect(result.success).toBe(true);
    });
  });

  describe('validateSkillDirectory', () => {
    it('should validate valid skill directory', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# Skill');
      
      const result = await validator.validateSkillDirectory(skillDir);
      expect(result.success).toBe(true);
    });

    it('should reject non-existing directory', async () => {
      const result = await validator.validateSkillDirectory(resolve(testDir, 'nonexistent'));
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('does not exist');
      }
    });

    it('should reject file instead of directory', async () => {
      const filePath = resolve(testDir, 'not-a-dir');
      await writeFile(filePath, 'content');
      
      const result = await validator.validateSkillDirectory(filePath);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('not a directory');
      }
    });

    it('should reject directory without SKILL.md', async () => {
      const skillDir = resolve(testDir, 'incomplete-skill');
      await mkdir(skillDir, { recursive: true });
      
      const result = await validator.validateSkillDirectory(skillDir);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('SKILL.md not found');
      }
    });

    it('should reject directory with unreadable SKILL.md', async () => {
      const skillDir = resolve(testDir, 'locked-skill');
      await mkdir(skillDir, { recursive: true });
      const skillMdPath = resolve(skillDir, 'SKILL.md');
      await writeFile(skillMdPath, '# Skill');
      await chmod(skillMdPath, 0o000);
      
      const result = await validator.validateSkillDirectory(skillDir);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('SKILL.md not found');
      }
    });
  });
});
