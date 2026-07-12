import { directoryExists } from "@/infrastructure/shared/utils/fsUtils";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";
import type { ProfileMetadata } from "@/core/domain/shared/entities/Profile";
import { ProfileMetadataReader } from "@/infrastructure/features/apply/adapters/ProfileMetadataReader";

export interface ProfileListItem extends ProfileMetadata {
  /** Directory name — the profile's identity used when applying. */
  name: string;
}

export interface ProfileListCommandResult {
  profiles: string[];
  details: ProfileListItem[];
  warnings: string[];
}

export class ProfileListCommand {
  private readonly metadataReader: ProfileMetadataReader;

  constructor(metadataReader?: ProfileMetadataReader) {
    this.metadataReader = metadataReader ?? new ProfileMetadataReader();
  }

  async execute(projectPath: string): Promise<Result<ProfileListCommandResult, Error>> {
    try {
      const configRoot = resolve(projectPath, ".agent-ctrl");
      const profilesPath = resolve(configRoot, "profiles");

      if (!(await directoryExists(configRoot))) {
        return err(
          new UserError(
            `No .agent-ctrl directory found in ${projectPath}. Initialize the project first.`,
            ERROR_IDS.NO_SUCH_FILE_OR_DIRECTORY
          )
        );
      }

      if (!(await directoryExists(profilesPath))) {
        return ok({ profiles: [], details: [], warnings: [] });
      }

      const entries = await readdir(profilesPath, { withFileTypes: true });
      const profiles = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      const reads = await Promise.all(
        profiles.map(async (name) => {
          const { metadata, warnings } = await this.metadataReader.read(resolve(profilesPath, name), name);
          return { item: { name, ...metadata }, warnings };
        })
      );

      const details: ProfileListItem[] = reads.map((r) => r.item);
      const warnings: string[] = reads.flatMap((r) => r.warnings);

      details.sort((a, b) => {
        const byCategory = a.category.localeCompare(b.category);
        if (byCategory !== 0) return byCategory;
        return a.displayName.localeCompare(b.displayName);
      });

      return ok({ profiles, details, warnings });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new UserError(`Failed to read profiles directory: ${message}`, ERROR_IDS.DIRECTORY_ACCESS_FAILED));
    }
  }
}
