import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { ListCommandsQuery } from "@/core/application/features/command/queries/ListCommandsQuery";

describe("ListCommandsQuery", () => {
  let query: ListCommandsQuery;
  let testDir: string;

  beforeEach(async () => {
    query = new ListCommandsQuery();
    testDir = resolve(tmpdir(), `commands-query-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it("returns discovered command artifacts", async () => {
    await writeFile(resolve(testDir, "explain.md"), "# Explain");
    await mkdir(resolve(testDir, "dev"), { recursive: true });
    await writeFile(resolve(testDir, "dev", "fix-lint.md"), "# Fix lint");

    const result = await query.execute({ commandsPath: testDir });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.artifacts).toHaveLength(2);
    expect(result.data.artifacts.map((artifact) => artifact.id).sort()).toEqual(["dev/fix-lint", "explain"]);
  });

  it("returns warnings for invalid files", async () => {
    await writeFile(resolve(testDir, "readme.txt"), "Invalid");

    const result = await query.execute({ commandsPath: testDir });
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.data.artifacts).toHaveLength(0);
    expect(result.data.warnings).toHaveLength(1);
    expect(result.data.warnings[0]).toContain("invalid extension");
  });
});
