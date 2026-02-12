export interface GlobalOptions {
  verbose?: boolean;
  quiet?: boolean;
}

export function getGlobalOptions(): GlobalOptions {
  // Parse from process.argv since Commander attaches them to program
  const args = process.argv.slice(2);
  return {
    verbose: args.includes("-v") || args.includes("--verbose"),
    quiet: args.includes("-q") || args.includes("--quiet"),
  };
}

export function logVerbose(message: string): void {
  const options = getGlobalOptions();
  if (options.verbose && !options.quiet) {
    console.log(`[verbose] ${message}`);
  }
}

export function logWarning(message: string): void {
  const options = getGlobalOptions();
  if (!options.quiet) {
    console.warn(`⚠ ${message}`);
  }
}

export function logSuccess(message: string): void {
  const options = getGlobalOptions();
  if (!options.quiet) {
    console.log(`✓ ${message}`);
  }
}

export function logError(message: string): void {
  const options = getGlobalOptions();
  if (!options.quiet) {
    console.error(`✗ ${message}`);
  }
}
