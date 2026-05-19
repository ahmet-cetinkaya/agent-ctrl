import { stat } from "node:fs/promises";

/**
 * Checks if a directory exists at the given path.
 * Resolves to true if it exists and is a directory, false otherwise.
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT" || nodeError.code === "ENOTDIR") {
        return false;
      }
    }
    throw error;
  }
}
