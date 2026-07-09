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

  let envPath: string;
  let exists = false;

  try {
    await readFile(projectEnvPath, "utf-8");
    envPath = projectEnvPath;
    exists = true;
  } catch {
    envPath = userEnvPath;
    try {
      await readFile(userEnvPath, "utf-8");
      exists = true;
    } catch {
      return { exists: false, variables: {} };
    }
  }

  try {
    const content = await readFile(envPath, "utf-8");
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

    return { exists, variables };
  } catch {
    return { exists: false, variables: {} };
  }
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
