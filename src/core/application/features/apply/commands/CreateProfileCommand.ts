import type { IFileSystem } from "@/core/domain/shared/interfaces/IFileSystem";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ProfileError } from "@/core/domain/shared/errors/ProfileError";
import { isValidProfileName } from "@/core/domain/shared/entities/Profile";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import { stringify as stringifyYaml } from "yaml";

export interface CreateProfileMetadata {
  /** Display name; falls back to the profile directory name when absent. */
  name?: string;
  description?: string;
  tags?: string[];
}

export interface CreateProfileCommandOptions {
  /** Absolute path to the .agent-ctrl config root. */
  configRoot: string;
  /** Directory name of the new profile — its identity when applying. */
  profileName: string;
  metadata?: CreateProfileMetadata;
}

export interface CreateProfileCommandResult {
  /** Absolute path of the created profile directory. */
  profilePath: string;
  /** Directory names created inside the profile, relative to the profile root. */
  createdDirectories: string[];
  /** Relative paths of files written inside the profile directory. */
  createdFiles: string[];
}

const PROFILE_METADATA_FILENAME = "profile.yaml";
const PROFILE_ARTIFACT_DIRECTORIES = ["rules", "skills", "agents", "commands", "mcps"];
const GITKEEP_FILE = ".gitkeep";

export class CreateProfileCommand {
  private readonly fileSystem: IFileSystem;

  constructor(fileSystem: IFileSystem) {
    this.fileSystem = fileSystem;
  }

  async execute(options: CreateProfileCommandOptions): Promise<Result<CreateProfileCommandResult, Error>> {
    if (!isValidProfileName(options.profileName)) {
      return err(
        new UserError(
          `Profile name '${options.profileName}' is invalid. Use letters, numbers, dashes and underscores only.`,
          ERROR_IDS.CLI_INVALID_ARGUMENT
        )
      );
    }

    try {
      await this.fileSystem.access(options.configRoot);
    } catch {
      return err(
        new UserError(
          `No .agent-ctrl directory found at ${options.configRoot}. Initialize the project first.`,
          ERROR_IDS.NO_SUCH_FILE_OR_DIRECTORY
        )
      );
    }

    const profilePath = this.fileSystem.resolve(options.configRoot, "profiles", options.profileName);

    try {
      await this.fileSystem.access(profilePath);
      return err(
        new ProfileError(
          `Profile '${options.profileName}' already exists in .agent-ctrl/profiles/`,
          options.profileName,
          ERROR_IDS.PROFILE_ALREADY_EXISTS
        )
      );
    } catch (error) {
      if (!this.isMissingFileError(error)) {
        return err(this.toSystemError("Failed to check profile directory", error));
      }
    }

    try {
      await this.fileSystem.mkdir(profilePath, { recursive: true });
    } catch (error) {
      return err(this.toSystemError("Failed to create profile directory", error));
    }

    const result = await this.scaffoldArtifactDirectories(profilePath);
    if (!result.success) {
      return err(result.error);
    }

    const metadataYaml = this.buildMetadataYaml(options.metadata);
    if (metadataYaml !== null) {
      const metadataPath = this.fileSystem.resolve(profilePath, PROFILE_METADATA_FILENAME);
      try {
        await this.fileSystem.writeFile(metadataPath, metadataYaml, "utf-8");
        result.data.createdFiles.push(PROFILE_METADATA_FILENAME);
      } catch (error) {
        return err(this.toSystemError("Failed to write profile.yaml", error));
      }
    }

    return ok({
      profilePath,
      createdDirectories: result.data.createdDirectories,
      createdFiles: result.data.createdFiles,
    });
  }

  private async scaffoldArtifactDirectories(
    profilePath: string
  ): Promise<Result<{ createdDirectories: string[]; createdFiles: string[] }, Error>> {
    const createdDirectories: string[] = [];
    const createdFiles: string[] = [];

    for (const dir of PROFILE_ARTIFACT_DIRECTORIES) {
      const dirPath = this.fileSystem.resolve(profilePath, dir);
      try {
        await this.fileSystem.mkdir(dirPath, { recursive: true });
      } catch (error) {
        return err(this.toSystemError(`Failed to create directory ${dir}`, error));
      }
      createdDirectories.push(dir);

      const gitkeepPath = this.fileSystem.resolve(dirPath, GITKEEP_FILE);
      try {
        await this.fileSystem.writeFile(gitkeepPath, "", "utf-8");
        createdFiles.push(`${dir}/${GITKEEP_FILE}`);
      } catch (error) {
        return err(this.toSystemError(`Failed to create ${GITKEEP_FILE} in directory ${dir}`, error));
      }
    }

    return ok({ createdDirectories, createdFiles });
  }

  /**
   * Serializes provided metadata into profile.yaml, or returns null when no
   * metadata was supplied so a bare profile directory is created instead.
   */
  private buildMetadataYaml(metadata?: CreateProfileMetadata): string | null {
    if (!metadata) {
      return null;
    }

    const record: Record<string, unknown> = {};
    const name = metadata.name?.trim();
    const description = metadata.description?.trim();
    const tags = (metadata.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);

    if (name) record.name = name;
    if (description) record.description = description;
    if (tags.length > 0) record.tags = tags;

    if (Object.keys(record).length === 0) {
      return null;
    }

    return stringifyYaml(record);
  }

  private isMissingFileError(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT";
  }

  private toSystemError(prefix: string, error: unknown): SystemError {
    const nodeErr = error as NodeJS.ErrnoException;
    let message = prefix;

    if (nodeErr.code === "EACCES") {
      message += ": Permission denied. Check directory permissions.";
    } else if (nodeErr.code === "ENOSPC") {
      message += ": No space left on device. Free up disk space and try again.";
    } else if (nodeErr.code === "EROFS") {
      message += ": Filesystem is read-only. Cannot write to this location.";
    } else if (error instanceof Error) {
      message += `: ${error.message}`;
    } else {
      message += `: ${String(error)}`;
    }

    return new SystemError(message, ERROR_IDS.DIRECTORY_CREATE_FAILED);
  }
}
