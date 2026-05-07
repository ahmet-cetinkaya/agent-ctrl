import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import type { Command } from 'commander';
import {
  getGlobalOptions,
  logVerbose,
  logWarning,
  logSuccess,
  logError,
  getLegacyGlobalOptions,
  type LogOptions,
} from '@/presentation/cli/shared/utils/globalOptions';
import { captureConsole } from '/home/ac/Code/ahmet-cetinkaya/agent-ctrl/tests/helpers/catalogTestUtils';

describe('globalOptions', () => {
  describe('getGlobalOptions', () => {
    it('should return default options when no options set', () => {
      const mockProgram = {
        opts: () => ({}),
      } as Command;

      const result = getGlobalOptions(mockProgram);
      expect(result).toEqual({ verbose: false, quiet: false });
    });

    it('should return verbose option when set', () => {
      const mockProgram = {
        opts: () => ({ verbose: true }),
      } as Command;

      const result = getGlobalOptions(mockProgram);
      expect(result).toEqual({ verbose: true, quiet: false });
    });

    it('should return quiet option when set', () => {
      const mockProgram = {
        opts: () => ({ quiet: true }),
      } as Command;

      const result = getGlobalOptions(mockProgram);
      expect(result).toEqual({ verbose: false, quiet: true });
    });

    it('should return both options when both set', () => {
      const mockProgram = {
        opts: () => ({ verbose: true, quiet: true }),
      } as Command;

      const result = getGlobalOptions(mockProgram);
      expect(result).toEqual({ verbose: true, quiet: true });
    });
  });

  describe('logVerbose', () => {
    let consoleCapture: ReturnType<typeof captureConsole>;

    beforeEach(() => {
      consoleCapture = captureConsole();
    });

    afterEach(() => {
      consoleCapture.restore();
    });

    it('should log message when verbose and not quiet', () => {
      const options: LogOptions = { verbose: true, quiet: false };
      logVerbose('Test message', options);
      expect(consoleCapture.logs.some((line) => line.includes('[verbose] Test message'))).toBe(true);
    });

    it('should not log message when not verbose', () => {
      const options: LogOptions = { verbose: false, quiet: false };
      logVerbose('Test message', options);
      expect(consoleCapture.logs.some((line) => line.includes('[verbose]'))).toBe(false);
    });

    it('should not log message when quiet even if verbose', () => {
      const options: LogOptions = { verbose: true, quiet: true };
      logVerbose('Test message', options);
      expect(consoleCapture.logs.some((line) => line.includes('[verbose]'))).toBe(false);
    });
  });

  describe('logWarning', () => {
    let consoleCapture: ReturnType<typeof captureConsole>;

    beforeEach(() => {
      consoleCapture = captureConsole();
    });

    afterEach(() => {
      consoleCapture.restore();
    });

    it('should log warning when not quiet', () => {
      const options: LogOptions = { verbose: false, quiet: false };
      logWarning('Test warning', options);
      expect(consoleCapture.logs.some((line) => line.includes('⚠ Test warning'))).toBe(true);
    });

    it('should not log warning when quiet', () => {
      const options: LogOptions = { verbose: false, quiet: true };
      logWarning('Test warning', options);
      expect(consoleCapture.logs.some((line) => line.includes('⚠'))).toBe(false);
    });
  });

  describe('logSuccess', () => {
    let consoleCapture: ReturnType<typeof captureConsole>;

    beforeEach(() => {
      consoleCapture = captureConsole();
    });

    afterEach(() => {
      consoleCapture.restore();
    });

    it('should log success message when not quiet', () => {
      const options: LogOptions = { verbose: false, quiet: false };
      logSuccess('Test success', options);
      expect(consoleCapture.logs.some((line) => line.includes('✓ Test success'))).toBe(true);
    });

    it('should not log success message when quiet', () => {
      const options: LogOptions = { verbose: false, quiet: true };
      logSuccess('Test success', options);
      expect(consoleCapture.logs.some((line) => line.includes('✓'))).toBe(false);
    });
  });

  describe('logError', () => {
    let consoleCapture: ReturnType<typeof captureConsole>;

    beforeEach(() => {
      consoleCapture = captureConsole();
    });

    afterEach(() => {
      consoleCapture.restore();
    });

    it('should log error message when not quiet', () => {
      const options: LogOptions = { verbose: false, quiet: false };
      logError('Test error', options);
      expect(consoleCapture.logs.some((line) => line.includes('✗ Test error'))).toBe(true);
    });

    it('should not log error message when quiet', () => {
      const options: LogOptions = { verbose: false, quiet: true };
      logError('Test error', options);
      expect(consoleCapture.logs.some((line) => line.includes('✗'))).toBe(false);
    });
  });

  describe('getLegacyGlobalOptions', () => {
    let originalArgv: string[];

    beforeEach(() => {
      originalArgv = process.argv.slice();
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it('should detect verbose flag with -v', () => {
      process.argv = ['node', 'script', '-v'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: true, quiet: false });
    });

    it('should detect verbose flag with --verbose', () => {
      process.argv = ['node', 'script', '--verbose'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: true, quiet: false });
    });

    it('should detect quiet flag with -q', () => {
      process.argv = ['node', 'script', '-q'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: false, quiet: true });
    });

    it('should detect quiet flag with --quiet', () => {
      process.argv = ['node', 'script', '--quiet'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: false, quiet: true });
    });

    it('should detect both flags', () => {
      process.argv = ['node', 'script', '-v', '-q'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: true, quiet: true });
    });

    it('should return default when no flags', () => {
      process.argv = ['node', 'script', 'other', 'args'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: false, quiet: false });
    });

    it('should ignore other arguments', () => {
      process.argv = ['node', 'script', '--other', 'value', '-v', 'more'];
      const result = getLegacyGlobalOptions();
      expect(result).toEqual({ verbose: true, quiet: false });
    });
  });
});
