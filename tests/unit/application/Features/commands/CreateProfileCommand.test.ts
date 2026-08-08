import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CreateProfileCommand } from "@/core/application/features/apply/commands/CreateProfileCommand";
import { NodeFileSystem } from "@/infrastructure/shared/file-system/NodeFileSystem";
import { ProfileMetadataReader } from "@/infrastructure/features/apply/adapters/ProfileMetadataReader";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { PROFILE_ARTIFACT_DIRECTORIES, PROFILE_GITKEEP_FILE } from "@/core/domain/shared/entities/Profile";
import type { IFileSystem, FileSystemEntry } from "@/core/domain/shared/interfaces/IFileSystem";

const GITKEEP_PATHS = PROFILE_ARTIFACT_DIRECTORIES.map((dir) => `${dir}/${PROFILE_GITKEEP_FILE}`);

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  );
}

function errnoError(code: string, message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(message), { code });
}

class StubFileSystem implements IFileSystem {
  mkdirError?: NodeJS.ErrnoException;
  writeError?: NodeJS.ErrnoException;
  accessError?: NodeJS.ErrnoException;
  mkdirFailOnCall?: number;
  writeFailOnCall?: number;
  mkdirCalls = 0;
  writeCalls = 0;
  accessCalls = 0;
  rmCalls: string[] = [];

  async mkdir(): Promise<void> {
    this.mkdirCalls += 1;
    if (this.mkdirError && (this.mkdirFailOnCall === undefined || this.mkdirFailOnCall === this.mkdirCalls)) {
      throw this.mkdirError;
    }
  }

  async writeFile(): Promise<void> {
    this.writeCalls += 1;
    if (this.writeError && (this.writeFailOnCall === undefined || this.writeFailOnCall === this.writeCalls)) {
      throw this.writeError;
    }
  }

  async access(): Promise<void> {
    this.accessCalls += 1;
    // First access targets the config root (exists); the profile path does not exist yet.
    if (this.accessCalls === 1) {
      if (this.accessError) throw this.accessError;
      return;
    }
    throw errnoError("ENOENT", "ENOENT: no such file or directory");
  }

  async readdir(): Promise<FileSystemEntry[]> {
    return [];
  }

  async rm(path: string): Promise<void> {
    this.rmCalls.push(path);
  }

  resolve(...paths: string[]): string {
    return join(...paths);
  }
}

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
    expect(result.data.createdDirectories).toEqual([...PROFILE_ARTIFACT_DIRECTORIES]);
    expect(result.data.createdFiles).toEqual(GITKEEP_PATHS);

    const dirExists = await pathExists(join(configRoot, "profiles", "backend"));
    expect(dirExists).toBe(true);

    const profileRoot = join(configRoot, "profiles", "backend");
    for (const dir of PROFILE_ARTIFACT_DIRECTORIES) {
      const gitkeep = join(profileRoot, dir, PROFILE_GITKEEP_FILE);
      const exists = await pathExists(gitkeep);
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
    expect(result.data.createdDirectories).toEqual([...PROFILE_ARTIFACT_DIRECTORIES]);
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

    const fileExists = await pathExists(join(configRoot, "profiles", "bare", "profile.yaml"));
    expect(fileExists).toBe(false);

    const profileRoot = join(configRoot, "profiles", "bare");
    const entries = await readdir(profileRoot);
    expect(entries).toEqual(expect.arrayContaining([...PROFILE_ARTIFACT_DIRECTORIES]));
  });

  it("rejects an invalid profile name", async () => {
    const result = await command.execute({ configRoot, profileName: "bad name!" });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBeInstanceOf(UserError);
    if (!(result.error instanceof UserError)) return;
    expect(result.error.errorId).toBe(ERROR_IDS.CLI_INVALID_ARGUMENT);
    expect(result.error.message).toContain("invalid");

    const dirExists = await pathExists(join(configRoot, "profiles", "bad name!"));
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
    if (!(result.error instanceof UserError)) return;
    expect(result.error.errorId).toBe(ERROR_IDS.NO_SUCH_FILE_OR_DIRECTORY);
    expect(result.error.message).toContain(".agent-ctrl");
  });

  describe("system error mapping", () => {
    it("maps config root access EACCES to SystemError with DIRECTORY_ACCESS_FAILED", async () => {
      const stub = new StubFileSystem();
      stub.accessError = errnoError("EACCES", "EACCES: permission denied");
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.DIRECTORY_ACCESS_FAILED);
      expect(result.error.message).toContain("Permission denied");
    });

    it("maps mkdir EACCES to SystemError with DIRECTORY_CREATE_FAILED", async () => {
      const stub = new StubFileSystem();
      stub.mkdirError = errnoError("EACCES", "EACCES: permission denied");
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.DIRECTORY_CREATE_FAILED);
      expect(result.error.message).toContain("Permission denied");
    });

    it("maps mkdir ENOSPC to SystemError with a space hint", async () => {
      const stub = new StubFileSystem();
      stub.mkdirError = errnoError("ENOSPC", "ENOSPC: no space left");
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.DIRECTORY_CREATE_FAILED);
      expect(result.error.message).toContain("No space left");
    });

    it("maps mkdir EROFS to SystemError with a read-only hint", async () => {
      const stub = new StubFileSystem();
      stub.mkdirError = errnoError("EROFS", "EROFS: read-only filesystem");
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.DIRECTORY_CREATE_FAILED);
      expect(result.error.message).toContain("read-only");
    });

    it("maps gitkeep write EACCES to SystemError with FILE_WRITE_FAILED", async () => {
      const stub = new StubFileSystem();
      stub.writeError = errnoError("EACCES", "EACCES: permission denied");
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.FILE_WRITE_FAILED);
      expect(result.error.message).toContain("Permission denied");
    });

    it("maps a non-errno error to SystemError carrying its message", async () => {
      const stub = new StubFileSystem();
      stub.mkdirError = Object.assign(new Error("boom"), { code: undefined });
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.DIRECTORY_CREATE_FAILED);
      expect(result.error.message).toContain("boom");
    });

    it("removes the partial profile when scaffolding fails after the profile directory was created", async () => {
      const stub = new StubFileSystem();
      stub.mkdirError = errnoError("EACCES", "EACCES: permission denied");
      stub.mkdirFailOnCall = 2;
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({ configRoot, profileName: "backend" });

      expect(result.success).toBe(false);
      expect(stub.rmCalls).toEqual([join(configRoot, "profiles", "backend")]);
    });

    it("removes the partial profile when the profile.yaml write fails", async () => {
      const stub = new StubFileSystem();
      stub.writeError = errnoError("ENOSPC", "ENOSPC: no space left");
      stub.writeFailOnCall = PROFILE_ARTIFACT_DIRECTORIES.length + 1;
      const command = new CreateProfileCommand(stub);

      const result = await command.execute({
        configRoot,
        profileName: "backend",
        metadata: { name: "Backend" },
      });

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBeInstanceOf(SystemError);
      if (!(result.error instanceof SystemError)) return;
      expect(result.error.errorId).toBe(ERROR_IDS.FILE_WRITE_FAILED);
      expect(stub.rmCalls).toEqual([join(configRoot, "profiles", "backend")]);
    });
  });
});
