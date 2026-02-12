import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ListAgentsQuery } from '@/core/application/features/agent/queries/ListAgentsQuery';
import { AgentScanner } from '@/infrastructure/features/agent/scanners/AgentScanner';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { ArtifactType } from '@/core/domain/shared/value-objects/ArtifactType';

describe('ListAgentsQuery', () => {
  let query: ListAgentsQuery;
  let testDir: string;
  let scanner: AgentScanner;

  beforeEach(async () => {
    scanner = new AgentScanner();
    query = new ListAgentsQuery(scanner);
    testDir = resolve(tmpdir(), `agents-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('execute', () => {
    it('should return empty list for empty directory', async () => {
      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings).toEqual([]);
      }
    });

    it('should find markdown agent files', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');

      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe('my-agent');
        expect(result.data.artifacts[0].filename).toBe('my-agent.md');
        expect(result.data.artifacts[0].type).toBe(ArtifactType.AGENT);
      }
    });

    it('should find .markdown extension files', async () => {
      await writeFile(resolve(testDir, 'my-agent.markdown'), '# My Agent');

      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.artifacts[0].id).toBe('my-agent');
        expect(result.data.artifacts[0].filename).toBe('my-agent.markdown');
      }
    });

    it('should find multiple agent files', async () => {
      await writeFile(resolve(testDir, 'agent-1.md'), '# Agent 1');
      await writeFile(resolve(testDir, 'agent-2.md'), '# Agent 2');
      await writeFile(resolve(testDir, 'agent-3.markdown'), '# Agent 3');

      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(3);
        expect(result.data.artifacts.map(a => a.id).sort()).toEqual(['agent-1', 'agent-2', 'agent-3']);
      }
    });

    it('should skip non-markdown files', async () => {
      await writeFile(resolve(testDir, 'my-agent.md'), '# My Agent');
      await writeFile(resolve(testDir, 'readme.txt'), 'Read me');
      await writeFile(resolve(testDir, 'config.json'), '{}');

      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(1);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings.some(w => w.includes('invalid extension'))).toBe(true);
      }
    });

    it('should handle mixed markdown extensions', async () => {
      await writeFile(resolve(testDir, 'agent-1.md'), '# Agent 1');
      await writeFile(resolve(testDir, 'agent-2.markdown'), '# Agent 2');

      const result = await query.execute({ agentsPath: testDir });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts.length).toBe(2);
        expect(result.data.artifacts.map(a => a.id).sort()).toEqual(['agent-1', 'agent-2']);
      }
    });

    it('should return error on scan failure', async () => {
      const result = await query.execute({ agentsPath: '/nonexistent/directory/path' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.artifacts).toEqual([]);
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(result.data.warnings[0]).toContain('Failed to scan');
      }
    });
  });
});
