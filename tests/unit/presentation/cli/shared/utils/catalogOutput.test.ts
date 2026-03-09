import { describe, it, expect } from 'bun:test';
import {
  renderCatalogSearchResults,
  renderCatalogItems,
  renderRegistryStatus,
  renderSyncReport,
  renderLifecycleSummary,
} from '@/presentation/cli/shared/utils/catalogOutput';
import type { CatalogItem, SourceRegistry, SyncReport } from '@/core/domain/shared/entities';

describe('catalogOutput', () => {
  describe('renderCatalogSearchResults', () => {
    it('should return message for empty results', () => {
      const result = renderCatalogSearchResults([]);
      expect(result).toEqual(['No catalog items matched the current query.']);
    });

    it('should render item display name and source', () => {
      const items: CatalogItem[] = [
        {
          catalogKey: 'skillsmp:test-item',
          itemType: 'skill',
          registryId: 'skillsmp',
          sourceItemId: 'test-item',
          displayName: 'Test Item',
          description: 'Test Description',
          compatibilityState: 'compatible',
          activationState: 'active',
          availabilityState: 'available',
          sourceVersion: '1.0.0',
          capabilities: [],
          categories: [],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = renderCatalogSearchResults(items);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Results: 1');
      expect(resultStr).toContain('- Test Item');
      expect(resultStr).toContain('Source: skillsmp:test-item');
      expect(resultStr).toContain('Description: Test Description');
      expect(result.length).toBeGreaterThan(1);
    });

    it('should render without description when missing', () => {
      const items: CatalogItem[] = [
        {
          catalogKey: 'skillsmp:test-item',
          itemType: 'skill',
          registryId: 'skillsmp',
          sourceItemId: 'test-item',
          displayName: 'Test Item',
          description: undefined,
          compatibilityState: 'compatible',
          activationState: 'active',
          availabilityState: 'available',
          sourceVersion: undefined,
          capabilities: [],
          categories: [],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: undefined,
        },
      ];

      const result = renderCatalogSearchResults(items);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('- Test Item');
      expect(resultStr).toContain('Source: skillsmp:test-item');
      expect(resultStr).not.toContain('Description:');
    });

    it('should render multiple items', () => {
      const items: CatalogItem[] = [
        {
          catalogKey: 'smithery:item1',
          itemType: 'skill',
          registryId: 'smithery',
          sourceItemId: 'item1',
          displayName: 'Item 1',
          description: 'Description 1',
          compatibilityState: 'compatible',
          activationState: 'active',
          availabilityState: 'available',
          sourceVersion: undefined,
          capabilities: [],
          categories: [],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: undefined,
        },
        {
          catalogKey: 'skillsmp:item2',
          itemType: 'skill',
          registryId: 'skillsmp',
          sourceItemId: 'item2',
          displayName: 'Item 2',
          description: 'Description 2',
          compatibilityState: 'compatible',
          activationState: 'active',
          availabilityState: 'available',
          sourceVersion: undefined,
          capabilities: [],
          categories: [],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: undefined,
        },
      ];

      const result = renderCatalogSearchResults(items);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Results: 2');
      expect(resultStr).toContain('- Item 1');
      expect(resultStr).toContain('- Item 2');
    });
  });

  describe('renderCatalogItems', () => {
    it('should return message for empty results', () => {
      const result = renderCatalogItems([]);
      expect(result).toEqual(['No catalog items matched the current query.']);
    });

    it('should render full item details', () => {
      const items: CatalogItem[] = [
        {
          catalogKey: 'skillsmp:test-item',
          itemType: 'skill',
          registryId: 'skillsmp',
          sourceItemId: 'test-item',
          displayName: 'Test Item',
          description: 'Test Description',
          compatibilityState: 'compatible',
          activationState: 'active',
          availabilityState: 'available',
          sourceVersion: '1.0.0',
          capabilities: ['capability1', 'capability2'],
          categories: ['category1', 'category2'],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = renderCatalogItems(items);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Results: 1');
      expect(resultStr).toContain('- Test Item');
      expect(resultStr).toContain('Source: skillsmp:test-item');
      expect(resultStr).toContain('Status: compatibility=compatible, activation=active, availability=available');
      expect(resultStr).toContain('Version: 1.0.0');
      expect(resultStr).toContain('Capabilities: capability1, capability2');
      expect(resultStr).toContain('Categories: category1, category2');
      expect(resultStr).toContain('Last sync: 2024-01-01T00:00:00Z');
      expect(resultStr).toContain('Description: Test Description');
    });

    it('should handle item with minimal fields', () => {
      const items: CatalogItem[] = [
        {
          catalogKey: 'skillsmp:test-item',
          itemType: 'skill',
          registryId: 'skillsmp',
          sourceItemId: 'test-item',
          displayName: 'Minimal Item',
          description: undefined,
          compatibilityState: 'unknown',
          activationState: 'inactive',
          availabilityState: 'unavailable',
          sourceVersion: undefined,
          capabilities: [],
          categories: [],
          lastSeenAt: '2024-01-01T00:00:00Z',
          lastSyncAt: undefined,
        },
      ];

      const result = renderCatalogItems(items);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('- Minimal Item');
      expect(resultStr).toContain('Source: skillsmp:test-item');
      expect(resultStr).toContain('Status: compatibility=unknown, activation=inactive, availability=unavailable');
      expect(resultStr).not.toContain('Version:');
      expect(resultStr).not.toContain('Capabilities:');
      expect(resultStr).not.toContain('Categories:');
      expect(resultStr).not.toContain('Last sync:');
    });
  });

  describe('renderRegistryStatus', () => {
    it('should render registry with all fields', () => {
      const registry: SourceRegistry = {
        registryId: 'skillsmp',
        displayName: 'Test Registry',
        authState: 'configured',
        lastSyncStatus: 'success',
        lastSyncSucceededAt: '2024-01-01T00:00:00Z',
        cacheFreshUntil: '2024-01-02T00:00:00Z',
        catalogItemCount: 10,
      };

      const result = renderRegistryStatus(registry);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Registry: Test Registry');
      expect(resultStr).toContain('Auth: configured');
      expect(resultStr).toContain('Last status: success');
      expect(resultStr).toContain('Last success: 2024-01-01T00:00:00Z');
      expect(resultStr).toContain('Fresh until: 2024-01-02T00:00:00Z');
    });

    it('should render registry without optional timestamps', () => {
      const registry: SourceRegistry = {
        registryId: 'smithery',
        displayName: 'Test Registry',
        authState: 'missing',
        lastSyncStatus: 'failed',
        lastSyncSucceededAt: undefined,
        cacheFreshUntil: undefined,
        catalogItemCount: 0,
      };

      const result = renderRegistryStatus(registry);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Registry: Test Registry');
      expect(resultStr).toContain('Auth: missing');
      expect(resultStr).toContain('Last status: failed');
      expect(resultStr).toContain('Last success: never');
      expect(resultStr).toContain('Fresh until: unknown');
    });
  });

  describe('renderSyncReport', () => {
    it('should render summary with all counts', () => {
      const report: SyncReport = {
        startedAt: '2024-01-01T00:00:00Z',
        finishedAt: '2024-01-01T00:01:00Z',
        requestedRegistries: ['smithery'],
        requestedScopes: [],
        usedCachedData: false,
        totals: {
          discovered: 10,
          added: 3,
          updated: 2,
          unchanged: 4,
          skipped: 1,
          failed: 0,
          removed: 0,
        },
        registryResults: [
          {
            registryId: 'smithery',
            status: 'success',
            usedCache: false,
            itemCounts: {
              discovered: 5,
              changed: 2,
              skipped: 0,
              failed: 0,
            },
            issues: [],
          },
        ],
      };

      const result = renderSyncReport(report);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Sync summary:');
      expect(resultStr).toContain('Discovered: 10');
      expect(resultStr).toContain('Added: 3');
      expect(resultStr).toContain('Updated: 2');
      expect(resultStr).toContain('Unchanged: 4');
      expect(resultStr).toContain('Skipped: 1');
      expect(resultStr).toContain('Failed: 0');
    });

    it('should render registry results', () => {
      const report: SyncReport = {
        startedAt: '2024-01-01T00:00:00Z',
        finishedAt: '2024-01-01T00:01:00Z',
        requestedRegistries: ['smithery', 'skillsmp'],
        requestedScopes: [],
        usedCachedData: true,
        totals: {
          discovered: 5,
          added: 2,
          updated: 1,
          unchanged: 1,
          skipped: 0,
          failed: 1,
          removed: 0,
        },
        registryResults: [
          {
            registryId: 'smithery',
            status: 'success',
            usedCache: true,
            itemCounts: {
              discovered: 5,
              changed: 2,
              skipped: 0,
              failed: 0,
            },
            issues: [],
          },
          {
            registryId: 'skillsmp',
            status: 'partial',
            usedCache: false,
            itemCounts: {
              discovered: 0,
              changed: 0,
              skipped: 0,
              failed: 1,
            },
            issues: ['Rate limit reached', 'Timeout on item 3'],
          },
        ],
      };

      const result = renderSyncReport(report);
      const resultStr = result.join('\n');
      expect(resultStr).toContain('Registry smithery:');
      expect(resultStr).toContain('Status: success (cached)');
      expect(resultStr).toContain('Registry skillsmp:');
      expect(resultStr).toContain('Status: partial');
      expect(resultStr).toContain('Issue: Rate limit reached');
      expect(resultStr).toContain('Issue: Timeout on item 3');
    });
  });

  describe('renderLifecycleSummary', () => {
    it('should render lifecycle summary message', () => {
      const summary = {
        operation: 'activate' as const,
        status: 'success' as const,
        changed: 5,
        unchanged: 2,
        skipped: 0,
        failed: 0,
        unavailable: 0,
        message: 'Sync completed successfully',
      };

      const result = renderLifecycleSummary(summary);
      expect(result).toEqual(['Sync completed successfully']);
    });

    it('should render error message', () => {
      const summary = {
        operation: 'update' as const,
        status: 'failed' as const,
        changed: 0,
        unchanged: 0,
        skipped: 0,
        failed: 1,
        unavailable: 0,
        message: 'Sync failed: authentication error',
      };

      const result = renderLifecycleSummary(summary);
      expect(result).toEqual(['Sync failed: authentication error']);
    });
  });
});
