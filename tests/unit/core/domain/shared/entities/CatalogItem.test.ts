import { describe, it, expect } from 'bun:test';
import { createCatalogItem } from '@/core/domain/shared/entities/CatalogItem';

describe('createCatalogItem', () => {
  it('should generate catalogKey from registryId and sourceItemId when not provided', () => {
    const input = {
      registryId: 'skillsmp' as const,
      itemType: 'skill' as const,
      sourceItemId: 'test-skill',
      displayName: 'Test Skill',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      capabilities: ['code-review', 'refactoring'],
      categories: ['development', 'productivity'],
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    expect(result.catalogKey).toBe('skillsmp:test-skill');
    expect(result.registryId).toBe('skillsmp');
    expect(result.sourceItemId).toBe('test-skill');
  });

  it('should use provided catalogKey when available', () => {
    const input = {
      catalogKey: 'custom-key',
      registryId: 'smithery' as const,
      itemType: 'mcp' as const,
      sourceItemId: 'test-mcp',
      displayName: 'Test MCP',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      capabilities: [],
      categories: [],
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    expect(result.catalogKey).toBe('custom-key');
  });

  it('should sort capabilities alphabetically', () => {
    const input = {
      registryId: 'skillsmp' as const,
      itemType: 'skill' as const,
      sourceItemId: 'test',
      displayName: 'Test',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      capabilities: ['zebra', 'alpha', 'beta', 'gamma'],
      categories: [],
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    expect(result.capabilities).toEqual(['alpha', 'beta', 'gamma', 'zebra']);
  });

  it('should sort categories alphabetically', () => {
    const input = {
      registryId: 'smithery' as const,
      itemType: 'mcp' as const,
      sourceItemId: 'test',
      displayName: 'Test',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      capabilities: [],
      categories: ['productivity', 'development', 'automation', 'testing'],
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    expect(result.categories).toEqual(['automation', 'development', 'productivity', 'testing']);
  });

  it('should preserve all other properties', () => {
    const input = {
      registryId: 'skillsmp' as const,
      itemType: 'skill' as const,
      sourceItemId: 'test-skill',
      displayName: 'Test Skill',
      description: 'A test skill for unit testing',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      sourceVersion: '1.0.0',
      capabilities: [],
      categories: [],
      lastSeenAt: '2024-01-01T00:00:00Z',
      lastSyncAt: '2024-01-01T01:00:00Z',
      sourceUrl: 'https://example.com/skill',
      metadata: {
        author: 'Test Author',
        homepage: 'https://example.com',
        repository: 'https://github.com/test/skill',
      },
    };

    const result = createCatalogItem(input);

    expect(result.displayName).toBe('Test Skill');
    expect(result.description).toBe('A test skill for unit testing');
    expect(result.sourceVersion).toBe('1.0.0');
    expect(result.lastSeenAt).toBe('2024-01-01T00:00:00Z');
    expect(result.lastSyncAt).toBe('2024-01-01T01:00:00Z');
    expect(result.sourceUrl).toBe('https://example.com/skill');
    expect(result.metadata?.author).toBe('Test Author');
  });

  it('should handle empty arrays for capabilities and categories', () => {
    const input = {
      registryId: 'smithery' as const,
      itemType: 'mcp' as const,
      sourceItemId: 'test',
      displayName: 'Test',
      compatibilityState: 'unknown' as const,
      activationState: 'inactive' as const,
      availabilityState: 'unavailable' as const,
      capabilities: [],
      categories: [],
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    expect(result.capabilities).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it('should create new arrays for capabilities and categories (not modify input)', () => {
    const inputCapabilities = ['cap2', 'cap1'];
    const inputCategories = ['cat2', 'cat1'];
    const input = {
      registryId: 'skillsmp' as const,
      itemType: 'skill' as const,
      sourceItemId: 'test',
      displayName: 'Test',
      compatibilityState: 'compatible' as const,
      activationState: 'active' as const,
      availabilityState: 'available' as const,
      capabilities: inputCapabilities,
      categories: inputCategories,
      lastSeenAt: '2024-01-01T00:00:00Z',
    };

    const result = createCatalogItem(input);

    // Verify original arrays are unchanged
    expect(inputCapabilities).toEqual(['cap2', 'cap1']);
    expect(inputCategories).toEqual(['cat2', 'cat1']);

    // Verify result has sorted arrays
    expect(result.capabilities).toEqual(['cap1', 'cap2']);
    expect(result.categories).toEqual(['cat1', 'cat2']);

    // Verify they are different array instances
    expect(result.capabilities).not.toBe(inputCapabilities);
    expect(result.categories).not.toBe(inputCategories);
  });
});
