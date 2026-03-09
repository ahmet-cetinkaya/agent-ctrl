import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CatalogOperationLogStore } from '@/infrastructure/features/catalog/caching/CatalogOperationLogStore';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { OperationLogEntry } from '@/core/domain/shared/entities';

describe('CatalogOperationLogStore', () => {
  let store: CatalogOperationLogStore;
  let testDir: string;

  beforeEach(async () => {
    store = new CatalogOperationLogStore();
    testDir = resolve(tmpdir(), `operation-log-store-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('append', () => {
    it('should append operation log entry to log file', async () => {
      const entry: OperationLogEntry = {
        occurredAt: '2024-01-01T00:00:00Z',
        operation: 'sync',
        artifactType: 'skill',
        artifactId: 'test-skill',
        status: 'success',
        details: { message: 'Sync completed successfully' },
      };

      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }

      // Verify file was created and contains the entry
      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      const logLines = logContent.trim().split('\n');
      expect(logLines).toHaveLength(1);
      expect(JSON.parse(logLines[0])).toEqual(entry);
    });

    it('should append multiple entries to the same file', async () => {
      const entry1: OperationLogEntry = {
        occurredAt: '2024-01-01T00:00:00Z',
        operation: 'sync',
        artifactType: 'skill',
        artifactId: 'skill1',
        status: 'success',
        details: { message: 'First sync' },
      };

      const entry2: OperationLogEntry = {
        occurredAt: '2024-01-01T01:00:00Z',
        operation: 'add',
        artifactType: 'mcp',
        artifactId: 'mcp1',
        status: 'success',
        details: { message: 'Second sync' },
      };

      await store.append(testDir, entry1);
      await store.append(testDir, entry2);

      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      const logLines = logContent.trim().split('\n');
      expect(logLines).toHaveLength(2);

      expect(JSON.parse(logLines[0])).toEqual(entry1);
      expect(JSON.parse(logLines[1])).toEqual(entry2);
    });

    it('should create log file directory if it does not exist', async () => {
      const entry: OperationLogEntry = {
        occurredAt: '2024-01-01T00:00:00Z',
        operation: 'sync',
        artifactType: 'skill',
        artifactId: 'test-skill',
        status: 'success',
        details: {},
      };

      // Don't create the .catalog directory beforehand
      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);

      // Verify file was created
      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      expect(logContent).toBeTruthy();
    });

    it('should handle entries with complex details', async () => {
      const entry: OperationLogEntry = {
        occurredAt: '2024-01-01T00:00:00Z',
        operation: 'update',
        artifactType: 'skill',
        artifactId: 'complex-skill',
        status: 'partial',
        details: {
          message: 'Update completed with warnings',
          warnings: ['Deprecated API used', 'Configuration missing'],
          stats: { filesUpdated: 5, filesSkipped: 2 },
        },
      };

      const result = await store.append(testDir, entry);

      expect(result.success).toBe(true);

      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      const parsedEntry = JSON.parse(logContent.trim());
      expect(parsedEntry).toEqual(entry);
      expect(parsedEntry.details.warnings).toEqual(['Deprecated API used', 'Configuration missing']);
    });

    it('should return error on file system failure', async () => {
      const entry: OperationLogEntry = {
        occurredAt: '2024-01-01T00:00:00Z',
        operation: 'sync',
        artifactType: 'skill',
        artifactId: 'test-skill',
        status: 'success',
        details: {},
      };

      // Use an invalid path that should cause appendFile to fail
      const invalidPath = '/root/nonexistent/path/that/cannot/be/created';

      const result = await store.append(invalidPath, entry);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to append catalog operation log');
      }
    });

    it('should handle entries with all artifact types', async () => {
      const artifactTypes: Array<'skill' | 'mcp' | 'rule' | 'command' | 'workflow'> = ['skill', 'mcp', 'rule', 'command', 'workflow'];

      for (const artifactType of artifactTypes) {
        const entry: OperationLogEntry = {
          occurredAt: '2024-01-01T00:00:00Z',
          operation: 'sync',
          artifactType,
          artifactId: `test-${artifactType}`,
          status: 'success',
          details: {},
        };

        const result = await store.append(testDir, entry);
        expect(result.success).toBe(true);
      }

      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      const logLines = logContent.trim().split('\n');
      expect(logLines).toHaveLength(5);

      const loggedTypes = logLines.map((line) => JSON.parse(line).artifactType);
      expect(loggedTypes).toEqual(artifactTypes);
    });

    it('should handle entries with different operation types', async () => {
      const operations: Array<'sync' | 'add' | 'remove' | 'update' | 'activate' | 'deactivate'> = [
        'sync',
        'add',
        'remove',
        'update',
        'activate',
        'deactivate',
      ];

      for (const operation of operations) {
        const entry: OperationLogEntry = {
          occurredAt: '2024-01-01T00:00:00Z',
          operation,
          artifactType: 'skill',
          artifactId: `test-${operation}`,
          status: 'success',
          details: {},
        };

        const result = await store.append(testDir, entry);
        expect(result.success).toBe(true);
      }

      const logContent = await readFile(resolve(testDir, '.catalog', 'operations.jsonl'), 'utf-8');
      const logLines = logContent.trim().split('\n');
      expect(logLines).toHaveLength(6);

      const loggedOperations = logLines.map((line) => JSON.parse(line).operation);
      expect(loggedOperations).toEqual(operations);
    });
  });
});
