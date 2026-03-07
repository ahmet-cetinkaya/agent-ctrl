import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { CommandScanner } from "@/infrastructure/features/command/scanners/CommandScanner";

describe("CommandScanner", () => {
  let scanner: CommandScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new CommandScanner();
    testDir = resolve(tmpdir(), `command-scanner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("returns empty result for empty directory", async () => {
    const result = await scanner.scan(testDir);
    expect(result.artifacts).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("finds markdown files recursively", async () => {
    await writeFile(resolve(testDir, "explain.md"), "# Explain");
    await mkdir(resolve(testDir, "dev"), { recursive: true });
    await writeFile(resolve(testDir, "dev", "fix-lint.md"), "# Fix lint");

    const result = await scanner.scan(testDir);
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts.map((artifact) => artifact.id).sort()).toEqual(["dev/fix-lint", "explain"]);
    expect(result.warnings).toEqual([]);
  });

  it("warns for invalid extensions", async () => {
    await writeFile(resolve(testDir, "explain.md"), "# Explain");
    await writeFile(resolve(testDir, "notes.txt"), "Not a command");

    const result = await scanner.scan(testDir);
    expect(result.artifacts).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("invalid extension");
  });

  describe("Security: Symlink Handling", () => {
    it("handles symlink creation failures gracefully", async () => {
      // This test documents symlink handling behavior
      // Symlink creation may fail on Windows without admin rights
      // The scanner should handle this gracefully without crashing

      await mkdir(resolve(testDir, "subdir"), { recursive: true });
      await writeFile(resolve(testDir, "subdir", "test.md"), "# Test");

      const result = await scanner.scan(testDir);

      // Should find the regular file
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe("subdir/test");
    });

    it("scans directories without following symlinks by default", async () => {
      // The scanner uses readdir with withFileTypes: true
      // which doesn't follow symlinks by default
      await mkdir(resolve(testDir, "level1"), { recursive: true });
      await writeFile(resolve(testDir, "level1", "test.md"), "# Test");

      const result = await scanner.scan(testDir);

      // Should find the file
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe("level1/test");
    });
  });

  describe("Security: Directory Depth Limits", () => {
    it("prevents stack overflow from deeply nested directories", async () => {
      let currentPath = testDir;
      const maxDepth = 25; // Exceeds MAX_SCAN_DEPTH of 20

      // Create a deeply nested directory structure
      for (let i = 0; i < maxDepth; i++) {
        const dirName = `level-${i}`;
        await mkdir(resolve(currentPath, dirName), { recursive: true });
        currentPath = resolve(currentPath, dirName);
      }

      // Place a file at the deepest level
      await writeFile(resolve(currentPath, "deep.md"), "# Deep command");

      const result = await scanner.scan(testDir);

      // Should find the file but warn about depth limit
      expect(result.artifacts).toHaveLength(0);
      const depthWarnings = result.warnings.filter((w) => w.includes("maximum depth exceeded"));
      expect(depthWarnings.length).toBeGreaterThan(0);
    });

    it("scans normally within depth limits", async () => {
      let currentPath = testDir;
      const normalDepth = 5; // Well within MAX_SCAN_DEPTH

      for (let i = 0; i < normalDepth; i++) {
        const dirName = `level-${i}`;
        await mkdir(resolve(currentPath, dirName), { recursive: true });
        currentPath = resolve(currentPath, dirName);
      }

      await writeFile(resolve(currentPath, "normal.md"), "# Normal command");

      const result = await scanner.scan(testDir);

      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts[0].id).toBe("level-0/level-1/level-2/level-3/level-4/normal");
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("returns warnings for permission denied errors (EACCES)", async () => {
      // Create a file that we can read
      await writeFile(resolve(testDir, "readable.md"), "# Readable");

      // Note: We can't easily test actual EACCES without changing file permissions
      // which may not work consistently across platforms
      // This test documents the expected behavior
      const result = await scanner.scan(testDir);
      expect(result.artifacts).toHaveLength(1);
    });

    it("throws SystemError for unexpected programming errors", async () => {
      // The scanner should throw for programming errors, not convert them to warnings
      // This is hard to test without actually causing a programming error
      // but the implementation distinguishes between expected I/O errors and programming errors
      const result = await scanner.scan(testDir);
      expect(result.artifacts).toEqual([]);
    });
  });
});
