import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
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

    const meta = await reader.read(profileDir, "machine-learning");

    expect(meta.displayName).toBe("Machine Learning");
    expect(meta.description).toBe("ML — agents and skills.");
    expect(meta.tags).toEqual(["ai", "training", "mlops"]);
    expect(meta.category).toBe("ai");
  });

  it("falls back to Uncategorized when profile.yaml is missing", async () => {
    const meta = await reader.read(profileDir, "bare-profile");

    expect(meta.displayName).toBe("bare-profile");
    expect(meta.description).toBe("");
    expect(meta.tags).toEqual([]);
    expect(meta.category).toBe("Uncategorized");
  });

  it("falls back to Uncategorized when tags are missing or empty", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `name: No Tags\ntags: []\n`, "utf-8");

    const meta = await reader.read(profileDir, "no-tags");

    expect(meta.displayName).toBe("No Tags");
    expect(meta.category).toBe("Uncategorized");
  });

  it("falls back without throwing on malformed yaml", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `name: [unterminated\n  : :`, "utf-8");

    const meta = await reader.read(profileDir, "broken");

    expect(meta.displayName).toBe("broken");
    expect(meta.category).toBe("Uncategorized");
  });

  it("uses directory name when name field is absent", async () => {
    await writeFile(join(profileDir, "profile.yaml"), `tags:\n  - web\n`, "utf-8");

    const meta = await reader.read(profileDir, "frontend");

    expect(meta.displayName).toBe("frontend");
    expect(meta.category).toBe("web");
  });
});
