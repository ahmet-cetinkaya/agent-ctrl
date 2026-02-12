import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SkillScanner } from '../../../../../src/infrastructure/features/skill/scanners/SkillScanner';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactType } from '../../../../../src/core/domain/shared/value-objects/ArtifactType';

describe('SkillScanner', () => {
  let scanner: SkillScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new SkillScanner();
    testDir = resolve(tmpdir(), `skill-scanner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('scan', () => {
    it('should return empty result for empty directory', async () => {
      const result = await scanner.scan(testDir);

      expect(result.artifacts).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should find directories with SKILL.md', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe('my-skill');
      expect(result.artifacts[0].directoryName).toBe('my-skill');
      expect(result.artifacts[0].type).toBe(ArtifactType.SKILL);
    });

    it('should find multiple skill directories', async () => {
      const skill1Dir = resolve(testDir, 'skill-1');
      const skill2Dir = resolve(testDir, 'skill-2');
      const skill3Dir = resolve(testDir, 'skill-3');

      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });
      await mkdir(skill3Dir, { recursive: true });
      await writeFile(resolve(skill1Dir, 'SKILL.md'), '# Skill 1');
      await writeFile(resolve(skill2Dir, 'SKILL.md'), '# Skill 2');
      await writeFile(resolve(skill3Dir, 'SKILL.md'), '# Skill 3');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(3);
      expect(result.artifacts.map(a => a.id).sort()).toEqual(['skill-1', 'skill-2', 'skill-3']);
    });

    it('should skip directories without SKILL.md', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toEqual([]);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('missing SKILL.md');
      expect(result.warnings[0]).toContain('my-skill');
    });

    it('should skip non-directory entries', async () => {
      await writeFile(resolve(testDir, 'readme.md'), '# Read me');
      await writeFile(resolve(testDir, 'other-file.txt'), 'Other content');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should handle mixed directories (valid and invalid)', async () => {
      const validSkill = resolve(testDir, 'valid-skill');
      const invalidSkill = resolve(testDir, 'invalid-skill');
      const fileEntry = resolve(testDir, 'file.md');

      await mkdir(validSkill, { recursive: true });
      await mkdir(invalidSkill, { recursive: true });
      await writeFile(resolve(validSkill, 'SKILL.md'), '# Valid Skill');
      await writeFile(fileEntry, '# File');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe('valid-skill');
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0]).toContain('invalid-skill');
    });

    it('should extract directory name as skill id', async () => {
      const skillDir = resolve(testDir, 'my-custom-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].id).toBe('my-custom-skill');
    });

    it('should return absolute paths', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].path).toBe(skillDir);
    });

    it('should handle case-sensitive SKILL.md filename', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await scanner.scan(testDir);
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe('my-skill');

      await writeFile(resolve(skillDir, 'skill.md'), '# Lowercase');
      const resultLower = await scanner.scan(testDir);

      expect(resultLower.artifacts).toHaveLength(1);
      expect(resultLower.artifacts[0].id).toBe('my-skill');
      expect(resultLower.warnings.length).toBe(0);
    });

    it('should handle scan errors gracefully', async () => {
      const result = await scanner.scan('/nonexistent/directory/path');

      expect(result.artifacts).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Failed to scan');
    });
  });
});
