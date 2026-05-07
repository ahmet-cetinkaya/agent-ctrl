import type { Command } from "commander";
import { LogService } from "@/presentation/cli/shared/utils/LogService";

export interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
}

export interface LogOptions extends GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
}

/**
 * Get global CLI options from Commander program
 * Provides proper access to command configuration instead of manual argv parsing
 */
export function getGlobalOptions(program: Command): LogOptions {
  const opts = program.opts() as { verbose?: boolean; quiet?: boolean };
  return {
    verbose: opts.verbose ?? false,
    quiet: opts.quiet ?? false,
  };
}

/**
 * Log verbose message if not quiet
 */
export function logVerbose(message: string, options: LogOptions): void {
  if (!options.quiet && options.verbose) {
    LogService.log(`[verbose] ${message}`);
  }
}

/**
 * Log warning message if not quiet
 */
export function logWarning(message: string, options: LogOptions): void {
  if (!options.quiet) {
    LogService.warn(`⚠ ${message}`);
  }
}

/**
 * Log success message if not quiet
 */
export function logSuccess(message: string, options: LogOptions): void {
  if (!options.quiet) {
    LogService.success(`✓ ${message}`);
  }
}

/**
 * Log error message if not quiet
 */
export function logError(message: string, options: LogOptions): void {
  if (!options.quiet) {
    LogService.error(`✗ ${message}`);
  }
}

/**
 * Legacy support for manual argv parsing (deprecated)
 */
export function getLegacyGlobalOptions(): GlobalOptions {
  const args = process.argv.slice(2);
  return {
    verbose: args.includes("-v") || args.includes("--verbose"),
    quiet: args.includes("-q") || args.includes("--quiet"),
  };
}
