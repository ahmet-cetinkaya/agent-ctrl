import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { CatalogCredentialBootstrap } from '@/infrastructure/features/catalog/caching/CatalogCredentialBootstrap';
import { CatalogEnvFileLoader } from '@/infrastructure/features/catalog/caching/CatalogEnvFileLoader';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Result, err, ok } from '@/core/domain/shared/value-objects/Result';

describe('CatalogCredentialBootstrap', () => {
  let testDir: string;
  let bootstrap: CatalogCredentialBootstrap;

  beforeEach(async () => {
    testDir = resolve(tmpdir(), `credential-bootstrap-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    await mkdir(resolve(testDir, '.agent-ctrl'), { recursive: true });
    bootstrap = new CatalogCredentialBootstrap();
  });

  afterEach(async () => {
    delete process.env.SKILLSMP_API_KEY;
    delete process.env.SKILLSMP_TOKEN;
    delete process.env.SMITHERY_API_KEY;
    delete process.env.SMITHERY_TOKEN;
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('applySkillCredentials', () => {
    it('should return undefined when no credentials available', async () => {
      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBeUndefined();
    });

    it('should use explicit API key when provided', async () => {
      const result = await bootstrap.applySkillCredentials(testDir, 'explicit-key');
      expect(result).toBe('explicit-key');
      expect(process.env.SKILLSMP_API_KEY).toBe('explicit-key');
    });

    it('should load SKILLSMP_API_KEY from env file', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SKILLSMP_API_KEY=file-api-key'
      );

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('file-api-key');
      expect(process.env.SKILLSMP_API_KEY).toBe('file-api-key');
    });

    it('should load SKILLSMP_TOKEN from env file as fallback', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SKILLSMP_TOKEN=file-token'
      );

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('file-token');
      expect(process.env.SKILLSMP_API_KEY).toBe('file-token');
    });

    it('should fall back to process.env.SKILLSMP_API_KEY', async () => {
      process.env.SKILLSMP_API_KEY = 'env-api-key';

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('env-api-key');
    });

    it('should fall back to process.env.SKILLSMP_TOKEN', async () => {
      process.env.SKILLSMP_TOKEN = 'env-token';

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('env-token');
    });

    it('should prioritize explicit key over env file', async () => {
      await writeFile(
        resolve(testDir, '.agent-ctrl', '.env'),
        'SKILLSMP_API_KEY=file-api-key'
      );

      const result = await bootstrap.applySkillCredentials(testDir, 'explicit-key');
      expect(result).toBe('explicit-key');
    });

    it('should prioritize env file over process.env', async () => {
      process.env.SKILLSMP_API_KEY = 'env-api-key';
      await writeFile(
        resolve(testDir, '.env'),
        'SKILLSMP_TOKEN=file-token'
      );

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('file-token');
    });

    it('should use SKILLSMP_API_KEY over SKILLSMP_TOKEN in env file', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SKILLSMP_TOKEN=token\nSKILLSMP_API_KEY=key'
      );

      const result = await bootstrap.applySkillCredentials(testDir);
      expect(result).toBe('key');
    });

    it('should throw when env loader fails', async () => {
      const mockLoader = {
        load: vi.fn().mockResolvedValue(err(new Error('Failed to load env file'))),
      } as unknown as CatalogEnvFileLoader;

      const mockBootstrap = new CatalogCredentialBootstrap(mockLoader);

      await expect(mockBootstrap.applySkillCredentials(testDir)).rejects.toThrow('Failed to load env file');
    });

    it('should handle missing data.values with empty object', async () => {
      const mockLoader = {
        load: vi.fn().mockResolvedValue(ok({ values: undefined })),
      } as unknown as CatalogEnvFileLoader;

      const mockBootstrap = new CatalogCredentialBootstrap(mockLoader);

      const result = await mockBootstrap.applySkillCredentials(testDir);
      expect(result).toBeUndefined();
    });
  });

  describe('applySmitheryCredentials', () => {
    it('should return undefined when no credentials available', async () => {
      const result = await bootstrap.applySmitheryCredentials(testDir);
      expect(result).toBeUndefined();
    });

    it('should use explicit API key when provided', async () => {
      const result = await bootstrap.applySmitheryCredentials(testDir, 'explicit-key');
      expect(result).toBe('explicit-key');
      expect(process.env.SMITHERY_API_KEY).toBe('explicit-key');
    });

    it('should load SMITHERY_API_KEY from env file', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SMITHERY_API_KEY=file-api-key'
      );

      const result = await bootstrap.applySmitheryCredentials(testDir);
      expect(result).toBe('file-api-key');
      expect(process.env.SMITHERY_API_KEY).toBe('file-api-key');
    });

    it('should load SMITHERY_TOKEN from env file as fallback', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SMITHERY_TOKEN=file-token'
      );

      const result = await bootstrap.applySmitheryCredentials(testDir);
      expect(result).toBe('file-token');
      expect(process.env.SMITHERY_API_KEY).toBe('file-token');
    });

    it('should fall back to process.env.SMITHERY_API_KEY', async () => {
      process.env.SMITHERY_API_KEY = 'env-api-key';

      const result = await bootstrap.applySmitheryCredentials(testDir);
      expect(result).toBe('env-api-key');
    });

    it('should fall back to process.env.SMITHERY_TOKEN', async () => {
      process.env.SMITHERY_TOKEN = 'env-token';

      const result = await bootstrap.applySmitheryCredentials(testDir);
      expect(result).toBe('env-token');
    });

    it('should throw when env loader fails', async () => {
      const mockLoader = {
        load: vi.fn().mockResolvedValue(err(new Error('Failed to load env file'))),
      } as unknown as CatalogEnvFileLoader;

      const mockBootstrap = new CatalogCredentialBootstrap(mockLoader);

      await expect(mockBootstrap.applySmitheryCredentials(testDir)).rejects.toThrow('Failed to load env file');
    });
  });

  describe('credential isolation', () => {
    it('should not mix skill and smithery credentials', async () => {
      await writeFile(
        resolve(testDir, '.env'),
        'SKILLSMP_API_KEY=skill-key\nSMITHERY_API_KEY=smithery-key'
      );

      await bootstrap.applySkillCredentials(testDir);
      await bootstrap.applySmitheryCredentials(testDir);

      expect(process.env.SKILLSMP_API_KEY).toBe('skill-key');
      expect(process.env.SMITHERY_API_KEY).toBe('smithery-key');
    });
  });
});
