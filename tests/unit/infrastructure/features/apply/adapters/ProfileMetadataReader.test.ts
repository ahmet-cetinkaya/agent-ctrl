import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ProfileMetadataReader } from "@/infrastructure/features/apply/adapters/ProfileMetadataReader";

describe("ProfileMetadataReader", () => {
  let profileDir: string;
  const reader = new ProfileMetadataReader();

  beforeEach(async () => {
    profileDir = await mkdtemp(join(tmpdir(), "profile-meta-"));
  });

  afterEach(async () => {
    await rm(profileDir, { recursive: true, force: true });
  });

  it("parses valid profile.yaml", async () => {
    await writeFile(
      join(profileDir, "profile.yaml"),
      `name: Machine Learning
description: "ML — agents and skills."
tags:
  - ai
  - training
  - mlops
`,
      "utf-8"
    );

    const { metadata, warnings } = await reader.read(profileDir, "machine-learning");

    expect(metadata.displayName).toBe("Machine Learning");
    expect(metadata.description).toBe("ML — agents and skills.");
    expect(metadata.tags).toEqual(["ai", "training", "mlops"]);
    expect(metadata.category).toBe("ai");
    expect(warnings).toEqual([]);
  });

  it("falls back to Uncategorized with no warnings when profile.yaml is missing", async () => {
    const { metadata, warnings } = await reader.read(profileDir, "bare-profile");

    expect(metadata.displayName).toBe("bare-profile");
    expect(metadata.description).toBe("");
    expect(metadata.tags).toEqual([]);
    expect(metadata.category).toBe("Uncategorized");
    expect(warnings).toEqual([]);
  });

  it("falls back to Uncategorized when tags are missing or empty", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `name: No Tags\ntags: []\n`, "utf-8");

    const { metadata, warnings } = await reader.read(profileDir, "no-tags");

    expect(metadata.displayName).toBe("No Tags");
    expect(metadata.category).toBe("Uncategorized");
    expect(warnings).toEqual([]);
  });

  it("falls back and reports a warning on malformed yaml", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `name: [unterminated\n  : :`, "utf-8");

    const { metadata, warnings } = await reader.read(profileDir, "broken");

    expect(metadata.displayName).toBe("broken");
    expect(metadata.category).toBe("Uncategorized");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("broken");
    expect(warnings[0]).toContain("malformed profile.yaml");
  });

  it("falls back and reports a warning when profile.yaml cannot be read", async () => {
    const filePath = join(profileDir, "profile.yaml");
    await writeFile(filePath, `name: Unreadable\n`, "utf-8");
    await chmod(filePath, 0o000);

    try {
      const { metadata, warnings } = await reader.read(profileDir, "unreadable");

      expect(metadata.displayName).toBe("unreadable");
      expect(metadata.category).toBe("Uncategorized");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("unreadable");
      expect(warnings[0]).toContain("failed to read profile.yaml");
    } finally {
      await chmod(filePath, 0o644);
    }
  });

  it("uses directory name when name field is absent", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `tags:\n  - web\n`, "utf-8");

    const { metadata, warnings } = await reader.read(profileDir, "frontend");

    expect(metadata.displayName).toBe("frontend");
    expect(metadata.category).toBe("web");
    expect(warnings).toEqual([]);
  });

  it("falls back with no warning when profile.yaml exists but is a directory", async () => {
    await mkdir(join(profileDir, "profile.yaml"));

    const { metadata, warnings } = await reader.read(profileDir, "dir-instead-of-file");

    expect(metadata.displayName).toBe("dir-instead-of-file");
    expect(metadata.category).toBe("Uncategorized");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("failed to read profile.yaml");
  });
});
