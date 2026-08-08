import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CreateProfileCommand } from "@/core/application/features/apply/commands/CreateProfileCommand";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";
import { ProfileMetadataReader } from "@/infrastructure/features/apply/adapters/ProfileMetadataReader";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

const ARTIFACT_DIRECTORIES = ["rules", "skills", "agents", "commands", "mcps"];
const GITKEEP_PATHS = ARTIFACT_DIRECTORIES.map((dir) => `${dir}/.gitkeep`);

describe("CreateProfileCommand", () => {
  let testDir: string;
  let configRoot: string;
  let fileSystem: NodeFileSystem;
  let command: CreateProfileCommand;

  beforeEach(async () => {
    testDir = join(tmpdir(), `agent-ctrl-create-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    configRoot = join(testDir, ".agent-ctrl");
    await mkdir(configRoot, { recursive: true });
    fileSystem = new NodeFileSystem();
    command = new CreateProfileCommand(fileSystem);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("creates a bare profile directory with scaffolded artifact subdirectories when no metadata is supplied", async () => {
    const result = await command.execute({ configRoot, profileName: "backend" });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.profilePath).toBe(join(configRoot, "profiles", "backend"));
    expect(result.data.createdDirectories).toEqual(ARTIFACT_DIRECTORIES);
    expect(result.data.createdFiles).toEqual(GITKEEP_PATHS);

    const dirExists = await access(join(configRoot, "profiles", "backend")).then(
      () => true,
      () => false
    );
    expect(dirExists).toBe(true);

    const profileRoot = join(configRoot, "profiles", "backend");
    for (const dir of ARTIFACT_DIRECTORIES) {
      const gitkeep = join(profileRoot, dir, ".gitkeep");
      const exists = await access(gitkeep).then(
        () => true,
        () => false
      );
      expect(exists).toBe(true);
    }
  });

  it("writes profile.yaml that round-trips through ProfileMetadataReader", async () => {
    const result = await command.execute({
      configRoot,
      profileName: "ml",
      metadata: { name: "Machine Learning", description: "ML profile", tags: ["ai", "mlops"] },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.createdDirectories).toEqual(ARTIFACT_DIRECTORIES);
    expect(result.data.createdFiles).toEqual([...GITKEEP_PATHS, "profile.yaml"]);

    const yaml = await readFile(join(configRoot, "profiles", "ml", "profile.yaml"), "utf-8");
    expect(yaml).toContain("name: Machine Learning");
    expect(yaml).toContain("description: ML profile");
    expect(yaml).toContain("tags:");

    const reader = new ProfileMetadataReader();
    const { metadata, warnings } = await reader.read(join(configRoot, "profiles", "ml"), "ml");
    expect(warnings).toEqual([]);
    expect(metadata.displayName).toBe("Machine Learning");
    expect(metadata.description).toBe("ML profile");
    expect(metadata.tags).toEqual(["ai", "mlops"]);
    expect(metadata.category).toBe("ai");
  });

  it("skips profile.yaml when metadata is empty but still scaffolds artifact directories", async () => {
    const result = await command.execute({
      configRoot,
      profileName: "bare",
      metadata: { name: "  ", description: "", tags: [" ", ""] },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.createdFiles).toEqual(GITKEEP_PATHS);

    const fileExists = await access(join(configRoot, "profiles", "bare", "profile.yaml")).then(
      () => true,
      () => false
    );
    expect(fileExists).toBe(false);

    const profileRoot = join(configRoot, "profiles", "bare");
    const entries = await readdir(profileRoot);
    expect(entries).toEqual(expect.arrayContaining(ARTIFACT_DIRECTORIES));
  });

  it("rejects an invalid profile name", async () => {
    const result = await command.execute({ configRoot, profileName: "bad name!" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(UserError);
    expect(result.error.message).toContain("invalid");

    const dirExists = await access(join(configRoot, "profiles", "bad name!")).then(
      () => true,
      () => false
    );
    expect(dirExists).toBe(false);
  });

  it("rejects a profile that already exists", async () => {
    await mkdir(join(configRoot, "profiles", "existing"), { recursive: true });

    const result = await command.execute({ configRoot, profileName: "existing" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(ProfileError);
    if (!(result.error instanceof ProfileError)) return;
    expect(result.error.message).toContain("already exists");
    expect(result.error.errorId).toBe(ERROR_IDS.PROFILE_ALREADY_EXISTS);
  });

  it("fails when the config root does not exist", async () => {
    await rm(configRoot, { recursive: true, force: true });

    const result = await command.execute({ configRoot, profileName: "backend" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(UserError);
    expect(result.error.message).toContain(".agent-ctrl");
  });
});
