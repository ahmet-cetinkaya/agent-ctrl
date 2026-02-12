import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AgentScanner } from '@/infrastructure/features/agent/scanners/AgentScanner';
import { createAgent } from '@/core/domain/shared/entities/Agent';
import { mkdir, rm, writeFile, chmod } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('AgentScanner', () => {
  let scanner: AgentScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new AgentScanner();
    testDir = resolve(tmpdir(), `agent-scanner-test-${Date.now()}`);
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

    it('should find .md files', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe('my-agent');
      expect(result.artifacts[0].filename).toBe('my-agent.md');
      expect(result.artifacts[0].type).toBe(ArtifactType.AGENT);
    });

    it('should find .markdown files', async () => {
      await writeFile(resolve(testDir, 'my-agent.markdown'), '# My Agent');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe('my-agent');
      expect(result.artifacts[0].filename).toBe('my-agent.markdown');
    });

    it('should find multiple agent files', async () => {
      await writeFile(resolve(testDir, 'agent1.md'), '# Agent 1');
      await writeFile(resolve(testDir, 'agent2.md'), '# Agent 2');
      await writeFile(resolve(testDir, 'agent3.markdown'), '# Agent 3');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(3);
      expect(result.artifacts.map(a => a.id).sort()).toEqual(['agent1', 'agent2', 'agent3']);
    });

    it('should skip non-markdown files', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');
      await writeFile(resolve(testDir, 'readme.txt'), 'Read me');
      await writeFile(resolve(testDir, 'config.json'), '{}');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.warnings.length).toBe(2);
      expect(result.warnings[0]).toContain('invalid extension');
      expect(result.warnings[1]).toContain('invalid extension');
    });

    it('should handle mixed case extensions', async () => {
      await writeFile(resolve(testDir, 'agent1.MD'), '# Agent 1');
      await writeFile(resolve(testDir, 'agent2.MarkDown'), '# Agent 2');

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(2);
      const sortedFilenames = result.artifacts.map(a => a.filename).sort();
      expect(sortedFilenames).toEqual(['agent1.MD', 'agent2.MarkDown']);
      const sortedIds = result.artifacts.map(a => a.id).sort();
      expect(sortedIds).toEqual(['agent1', 'agent2']);
    });

    it('should skip unreadable files', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');
      await chmod(resolve(testDir, 'my-agent.md'), 0o000);

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Could not read');
    });

    it('should extract id from filename', async () => {
      await writeFile(resolve(testDir, 'my-custom-agent.md'), '# My Agent');

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].id).toBe('my-custom-agent');
    });

    it('should handle filenames with multiple dots', async () => {
      await writeFile(resolve(testDir, 'my.agent.v2.md'), '# My Agent');

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].id).toBe('my.agent.v2');
      expect(result.artifacts[0].filename).toBe('my.agent.v2.md');
    });

    it('should return absolute paths', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');

      const result = await scanner.scan(testDir);

      expect(result.artifacts[0].path).toMatch(new RegExp(`^${testDir}`));
    });

    it('should handle scan errors gracefully', async () => {
      const result = await scanner.scan('/nonexistent/directory/path');

      expect(result.artifacts).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Failed to scan');
    });
  });
});
