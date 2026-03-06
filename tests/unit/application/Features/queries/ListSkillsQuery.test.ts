import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ListSkillsQuery } from '@/core/application/features/skill/queries/ListSkillsQuery';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('ListSkillsQuery', () => {
  let query: ListSkillsQuery;
  let testDir: string;

  beforeEach(async () => {
    query = new ListSkillsQuery();
    testDir = resolve(tmpdir(), `skills-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('execute', () => {
    it('should return empty list for empty directory', async () => {
      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings).toEqual([]);
      }
    });

    it('should find skill directories with SKILL.md', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe('my-skill');
        expect(result.data.artifacts[0].directoryName).toBe('my-skill');
        expect(result.data.artifacts[0].path).toBe(skillDir);
        expect(result.data.artifacts[0].type).toBe(ArtifactType.SKILL);
      }
    });

    it('should find multiple skill directories', async () => {
      const skill1Dir = resolve(testDir, 'skill-1');
      const skill2Dir = resolve(testDir, 'skill-2');

      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(resolve(skill1Dir, 'SKILL.md'), '# Skill 1');
      await writeFile(resolve(skill2Dir, 'SKILL.md'), '# Skill 2');

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(2);
        expect(result.data.artifacts.map(a => a.id).sort()).toEqual(['skill-1', 'skill-2']);
      }
    });

    it('should skip directories without SKILL.md', async () => {
      const skillDir = resolve(testDir, 'my-skill');
      await mkdir(skillDir, { recursive: true });

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]).toContain('missing SKILL.md');
      }
    });

    it('should skip non-directory entries', async () => {
      await writeFile(resolve(testDir, 'readme.md'), '# Read me');

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
      }
    });

    it('should handle mixed directories (valid and invalid)', async () => {
      const validSkill = resolve(testDir, 'valid-skill');
      const invalidSkill = resolve(testDir, 'invalid-skill');

      await mkdir(validSkill, { recursive: true });
      await mkdir(invalidSkill, { recursive: true });
      await writeFile(resolve(validSkill, 'SKILL.md'), '# Valid');

      const result = await query.execute({ skillsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe('valid-skill');
        expect(result.data.warnings.length).toBe(1);
      }
    });

    it('should return error on scan failure', async () => {
      const result = await query.execute({ skillsPath: '/nonexistent/directory/path' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]).toContain('Failed to scan');
      }
    });
  });
});
