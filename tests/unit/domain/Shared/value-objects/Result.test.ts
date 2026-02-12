import { describe, it, expect } from 'bun:test';
import { ok, err } from '@/core/domain/shared/value-objects/Result';

describe('Result', () => {
  describe('ok', () => {
    it('should create a successful result', () => {
      const result = ok('success');
      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });
  });

  describe('err', () => {
    it('should create an error result', () => {
      const error = new Error('test error');
      const result = err(error);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
    });
  });
});
