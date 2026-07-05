import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { copyMultiplePlatformSettings } from "@/core/filestore/copiers.js";

describe("copyMultiplePlatformSettings", () => {
  const root = "/tmp/test-copy-multi-unit";

  beforeEach(() => {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(root)) fs.rmSync(root, { recursive: true, force: true });
  });

  it("should return one result per platform", () => {
    const src1 = path.join(root, "src1");
    const src2 = path.join(root, "src2");
    fs.mkdirSync(src1);
    fs.mkdirSync(src2);
    fs.writeFileSync(path.join(src1, "a.txt"), "a");
    fs.writeFileSync(path.join(src2, "b.txt"), "b");

    const results = copyMultiplePlatformSettings([
      { source: src1, target: path.join(root, "t1") },
      { source: src2, target: path.join(root, "t2") },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].filesCopied).toBe(1);
    expect(results[1].filesCopied).toBe(1);
  });

  it("should return empty array for empty input", () => {
    const results = copyMultiplePlatformSettings([]);
    expect(results).toEqual([]);
  });

  it("should process platforms independently when one source is missing", () => {
    const src1 = path.join(root, "src1");
    fs.mkdirSync(src1);
    fs.writeFileSync(path.join(src1, "a.txt"), "a");

    const results = copyMultiplePlatformSettings([
      { source: src1, target: path.join(root, "t1") },
      { source: path.join(root, "nonexistent"), target: path.join(root, "t2") },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});
