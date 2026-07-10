import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";

/**
 * Environment variable loader for .env files.
 *
 * Purpose: Load environment variables from .agent-ctrl/.env for use in
 * platform-specific settings interpolation during copy operations.
 */

/**
 * Result of loading an .env file.
 */
export interface EnvLoadResult {
  exists: boolean;
  variables: Record<string, string>;
}

export interface LoadEnvFileOptions {
  userHomePath?: string;
}

/**
 * Loads environment variables from .agent-ctrl/.env.
 * Checks both project-level and user-level config directories.
 *
 * @param projectPath - Path to the project root
 * @returns Loaded environment variables (empty object if no .env found)
 */
export async function loadEnvFile(projectPath: string, options: LoadEnvFileOptions = {}): Promise<EnvLoadResult> {
  const projectEnvPath = resolve(projectPath, ".agent-ctrl", ".env");
  const userEnvPath = resolve(options.userHomePath ?? homedir(), ".agent-ctrl", ".env");

  const content = await readEnvFileContent(projectEnvPath, userEnvPath);
  if (content === null) {
    return { exists: false, variables: {} };
  }

  const variables: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const sepIndex = line.indexOf("=");
    if (sepIndex <= 0) {
      continue;
    }

    const key = line.slice(0, sepIndex).trim();
    const rawValue = line.slice(sepIndex + 1).trim();

    if (!key) {
      continue;
    }

    variables[key] = unquote(rawValue);
  }

  return { exists: true, variables };
}

/**
 * Reads the first available .env file, preferring the project-level path over
 * the user-level fallback. Returns null only when neither file exists; any
 * other read failure (e.g. permission denied) is propagated so callers don't
 * silently treat it as "no .env file present".
 */
async function readEnvFileContent(projectEnvPath: string, userEnvPath: string): Promise<string | null> {
  try {
    return await readFile(projectEnvPath, "utf-8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
  }

  try {
    return await readFile(userEnvPath, "utf-8");
  } catch (error) {
    if (!isFileNotFoundError(error)) {
      throw error;
    }
    return null;
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
    (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1);
  }
  return value;
}
