import { stat } from "node:fs/promises";

/**
 * Checks if a directory exists at the given path.
 * Resolves to true if it exists and is a directory, false otherwise.
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (error: any) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return false;
    }
    throw error;
  }
}
