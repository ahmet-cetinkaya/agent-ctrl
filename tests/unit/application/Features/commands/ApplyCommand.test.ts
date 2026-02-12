import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { ApplyCommand } from '../../../../../src/core/application/features/apply/commands/ApplyCommand';
import { mkdir, rm, writeFile, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { UserError } from '../../../../../src/core/domain/shared/errors/UserError';
import { SystemError } from '../../../../../src/core/domain/shared/errors/SystemError';
import { ArtifactType } from '../../../../../src/core/domain/shared/value-objects/ArtifactType';

describe('ApplyCommand', () => {
  let command: ApplyCommand;
  let testDir: string;
  let claudeConfigPath: string;

  beforeEach(async () => {
    command = new ApplyCommand();
    testDir = resolve(tmpdir(), `apply-command-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(resolve(testDir, 'rules'), { recursive: true });
    await mkdir(resolve(testDir, 'skills'), { recursive: true });
    await mkdir(resolve(testDir, 'agents'), { recursive: true });

    claudeConfigPath = resolve(homedir(), '.claude', 'config.json');
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}

    try {
      await rm(resolve(homedir(), '.claude'), { recursive: true, force: true });
    } catch {}
  });

  describe('execute', () => {
    it('should fail for unsupported platform', async () => {
      const result = await command.execute({
        projectPath: testDir,
        platform: 'unsupported-platform'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UserError);
        expect(result.error.message).toContain('not supported');
        expect(result.error.message).toContain('claude');
      }
    });

    it('should apply rules successfully to Claude', async () => {
      await writeFile(resolve(testDir, 'rules', 'my-rule.md'), '# My Rule');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        dryRun: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(1);
        expect(result.data.skillsApplied).toBe(0);
        expect(result.data.agentsApplied).toBe(0);
        expect(result.data.configPath).toBe(claudeConfigPath);
      }
    });

    it('should apply skills successfully to Claude', async () => {
      const skillDir = resolve(testDir, 'skills', 'my-skill');
      await mkdir(skillDir, { recursive: true });
      await writeFile(resolve(skillDir, 'SKILL.md'), '# My Skill');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        dryRun: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(0);
        expect(result.data.skillsApplied).toBe(1);
        expect(result.data.agentsApplied).toBe(0);
      }
    });

    it('should apply agents successfully to Claude', async () => {
      await writeFile(resolve(testDir, 'agents', 'my-agent.md'), '# My Agent');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        dryRun: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(0);
        expect(result.data.skillsApplied).toBe(0);
        expect(result.data.agentsApplied).toBe(1);
      }
    });

    it('should apply multiple artifacts to Claude', async () => {
      await writeFile(resolve(testDir, 'rules', 'rule1.md'), '# Rule 1');
      await writeFile(resolve(testDir, 'rules', 'rule2.md'), '# Rule 2');

      const skill1Dir = resolve(testDir, 'skills', 'skill1');
      const skill2Dir = resolve(testDir, 'skills', 'skill2');
      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });
      await writeFile(resolve(skill1Dir, 'SKILL.md'), '# Skill 1');
      await writeFile(resolve(skill2Dir, 'SKILL.md'), '# Skill 2');

      await writeFile(resolve(testDir, 'agents', 'agent1.md'), '# Agent 1');
      await writeFile(resolve(testDir, 'agents', 'agent2.md'), '# Agent 2');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        dryRun: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(2);
        expect(result.data.skillsApplied).toBe(2);
        expect(result.data.agentsApplied).toBe(2);
      }
    });

    it('should handle empty project gracefully', async () => {
      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        dryRun: true
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rulesApplied).toBe(0);
        expect(result.data.skillsApplied).toBe(0);
        expect(result.data.agentsApplied).toBe(0);
      }
    });

    it('should write config file successfully', async () => {
      await writeFile(resolve(testDir, 'rules', 'my-rule.md'), '# My Rule');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude'
      });

      expect(result.success).toBe(true);

      const configExists = await access(claudeConfigPath).then(() => true, () => false);
      expect(configExists).toBe(true);

      const configContent = await readFile(claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe('my-rule');
    });

    it('should merge with existing config', async () => {
      const claudeDir = resolve(homedir(), '.claude');
      await mkdir(claudeDir, { recursive: true });
      const existingConfig = {
        rules: [{ name: 'existing-rule', path: '/old/path' }],
        skills: [],
        agents: []
      };
      await writeFile(claudeConfigPath, JSON.stringify(existingConfig, null, 2));

      await writeFile(resolve(testDir, 'rules', 'new-rule.md'), '# New Rule');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude'
      });

      expect(result.success).toBe(true);

      const configContent = await readFile(claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.rules).toHaveLength(2);
      expect(config.rules.map((r: any) => r.name)).toContain('existing-rule');
      expect(config.rules.map((r: any) => r.name)).toContain('new-rule');
    });

    it('should replace entries with same name when not using force', async () => {
      const claudeDir = resolve(homedir(), '.claude');
      await mkdir(claudeDir, { recursive: true });
      const existingConfig = {
        rules: [{ name: 'my-rule', path: '/old/path' }],
        skills: [],
        agents: []
      };
      await writeFile(claudeConfigPath, JSON.stringify(existingConfig, null, 2));

      await writeFile(resolve(testDir, 'rules', 'my-rule.md'), '# Updated Rule');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude'
      });

      expect(result.success).toBe(true);

      const configContent = await readFile(claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].path).not.toBe('/old/path');
      expect(config.rules[0].path).toContain('my-rule.md');
    });

    it('should use force option to overwrite existing config', async () => {
      const claudeDir = resolve(homedir(), '.claude');
      await mkdir(claudeDir, { recursive: true });
      const existingConfig = {
        rules: [{ name: 'existing-rule', path: '/old/path' }],
        skills: [],
        agents: []
      };
      await writeFile(claudeConfigPath, JSON.stringify(existingConfig, null, 2));

      await writeFile(resolve(testDir, 'rules', 'new-rule.md'), '# New Rule');

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude',
        force: true
      });

      expect(result.success).toBe(true);

      const configContent = await readFile(claudeConfigPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config.rules).toHaveLength(1);
      expect(config.rules[0].name).toBe('new-rule');
      expect(config.rules.map((r: any) => r.name)).not.toContain('existing-rule');
    });
  });

  describe('error handling', () => {
    it('should handle permission errors when writing config', async () => {
      await writeFile(resolve(testDir, 'rules', 'my-rule.md'), '# My Rule');

      const claudeDir = resolve(homedir(), '.claude');
      await mkdir(claudeDir, { recursive: true });
      await writeFile(claudeConfigPath, 'locked content', { mode: 0o444 });

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(SystemError);
        expect(result.error.message).toContain('Permission denied');
      }
    });

    it('should create config directory if it does not exist', async () => {
      await writeFile(resolve(testDir, 'rules', 'my-rule.md'), '# My Rule');

      const claudeDir = resolve(homedir(), '.claude');
      await rm(claudeDir, { recursive: true, force: true });

      const result = await command.execute({
        projectPath: testDir,
        platform: 'claude'
      });

      expect(result.success).toBe(true);

      const dirExists = await access(claudeDir).then(() => true, () => false);
      expect(dirExists).toBe(true);
    });
  });
});
