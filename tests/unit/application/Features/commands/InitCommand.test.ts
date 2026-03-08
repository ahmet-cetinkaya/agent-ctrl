import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { InitCommand } from '@/core/application/features/init/commands/InitCommand';
import { NodeFileSystem } from '@/infrastructure/shared/file-system/NodeFileSystem';
import { mkdir, rm, access, readFile } from 'node:fs/promises';
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
      expect(result.data.createdDirectories).toContain('.agent-ctrl/mcps');
      expect(result.data.createdFiles).toContain('rules/.gitkeep');
      expect(result.data.createdFiles).toContain('skills/.gitkeep');
      expect(result.data.createdFiles).toContain('agents/.gitkeep');
      expect(result.data.createdFiles).toContain('commands/.gitkeep');
      expect(result.data.createdFiles).toContain('.agent-ctrl/mcps/.gitkeep');
      expect(result.data.createdFiles).toContain('README.md');
    }

    const mcpDirExists = await access(resolve(testDir, '.agent-ctrl', 'mcps')).then(
      () => true,
      () => false,
    );
    expect(mcpDirExists).toBe(true);

    const gitkeepPaths = [
      resolve(testDir, 'rules', '.gitkeep'),
      resolve(testDir, 'skills', '.gitkeep'),
      resolve(testDir, 'agents', '.gitkeep'),
      resolve(testDir, 'commands', '.gitkeep'),
      resolve(testDir, '.agent-ctrl', 'mcps', '.gitkeep'),
    ];

    for (const path of gitkeepPaths) {
      const exists = await access(path).then(
        () => true,
        () => false,
      );
      expect(exists).toBe(true);
    }

    const readmePath = resolve(testDir, 'README.md');
    const readmeExists = await access(readmePath).then(
      () => true,
      () => false,
    );
    expect(readmeExists).toBe(true);
    const readmeContent = await readFile(readmePath, 'utf-8');
    expect(readmeContent).toContain('# agent-ctrl configuration');
    expect(readmeContent).toContain('agent-ctrl is a CLI tool for managing AI agent configurations');
    expect(readmeContent).toContain('https://github.com/ahmet-cetinkaya/agent-ctrl');
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

  it('should create mcps directly when target is config root', async () => {
    const targetConfigRoot = resolve(testDir, '.agent-ctrl');
    await mkdir(targetConfigRoot, { recursive: true });

    const initCommand = new InitCommand(fileSystem);
    const result = await initCommand.execute({ targetPath: targetConfigRoot });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdDirectories).toContain('mcps');
      expect(result.data.createdDirectories).not.toContain('.agent-ctrl/mcps');
      expect(result.data.createdFiles).toContain('mcps/.gitkeep');
      expect(result.data.createdFiles).not.toContain('.agent-ctrl/mcps/.gitkeep');
      expect(result.data.createdFiles).toContain('README.md');
    }

    const mcpDirExists = await access(resolve(targetConfigRoot, 'mcps')).then(
      () => true,
      () => false,
    );
    expect(mcpDirExists).toBe(true);

    const nestedMcpDirExists = await access(resolve(targetConfigRoot, '.agent-ctrl', 'mcps')).then(
      () => true,
      () => false,
    );
    expect(nestedMcpDirExists).toBe(false);

  });
});
