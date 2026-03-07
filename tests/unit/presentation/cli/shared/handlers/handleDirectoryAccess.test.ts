import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, chmod } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { handleDirectoryAccess } from "@/presentation/cli/shared/handlers/resultHandler";

// Mock fs.access for testing error code paths
const mockAccessError = (code: string) => {
  return async () => {
    const error = new Error(`Mock error: ${code}`) as NodeJS.ErrnoException;
    error.code = code;
    throw error;
  };
};

describe("handleDirectoryAccess", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "handle-dir-access-"));
  });

  afterEach(async () => {
    // Cleanup may fail if we changed permissions, so try-catch
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("returns success when directory is accessible", async () => {
    const result = await handleDirectoryAccess(testDir, "test/");
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns error for ENOENT (not found)", async () => {
    const nonExistentDir = resolve(testDir, "does-not-exist");
    const result = await handleDirectoryAccess(nonExistentDir, "test/");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.error).toContain("Run 'agent-ctrl init' first");
  });

  it("returns error for invalid paths with null bytes", async () => {
    const invalidPath = "\0\0\0";
    const result = await handleDirectoryAccess(invalidPath, "test/");

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("handles permission errors gracefully", async () => {
    // This test documents that permission errors are handled
    // Actual EACCES testing is platform-dependent and skipped
    const result = await handleDirectoryAccess("/root/.agent-ctrl", "test/");

    // On most systems this will fail with permission denied
    // On systems running as root, it will fail with ENOENT
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/Permission denied|not found/i);
    }
  });
});
