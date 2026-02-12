import { describe, it, expect } from 'bun:test';
import { UserError } from '../../../../../src/core/domain/shared/errors/UserError';
import { SystemError } from '../../../../../src/core/domain/shared/errors/SystemError';

describe('Errors', () => {
  describe('UserError', () => {
    it('should have exit code 1', () => {
      const error = new UserError('test error');
      expect(error.exitCode).toBe(1);
      expect(error.type).toBe('UserError');
      expect(error.message).toBe('test error');
    });
  });

  describe('SystemError', () => {
    it('should have exit code 2', () => {
      const error = new SystemError('test error');
      expect(error.exitCode).toBe(2);
      expect(error.type).toBe('SystemError');
      expect(error.message).toBe('test error');
    });
  });
});
