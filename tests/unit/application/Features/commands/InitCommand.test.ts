import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { InitCommand } from '@/core/application/features/init/commands/InitCommand';
import { NodeFileSystem } from '@/infrastructure/shared/file-system/NodeFileSystem';
import { mkdir, rm, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('InitCommand', () => {
  let testDir: string;
  let fileSystem: NodeFileSystem;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `agent-ctrl-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    fileSystem = new NodeFileSystem();
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should initialize a project successfully', async () => {
    const initCommand = new InitCommand(fileSystem);
    const result = await initCommand.execute({ targetPath: testDir });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdDirectories).toContain('rules');
      expect(result.data.createdDirectories).toContain('skills');
      expect(result.data.createdDirectories).toContain('agents');
      expect(result.data.createdDirectories).toContain('commands');
      expect(result.data.createdFiles).toContain('agent-ctrl.config.json');
    }
  });

  it('should fail on non-empty directory', async () => {
    const initCommand = new InitCommand(fileSystem);
    
    await initCommand.execute({ targetPath: testDir });
    
    const result = await initCommand.execute({ targetPath: testDir });
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('not empty');
    }
  });
});
