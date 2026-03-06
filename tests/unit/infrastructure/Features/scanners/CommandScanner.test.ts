import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
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
});
