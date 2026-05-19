import { directoryExists } from "@/infrastructure/shared/utils/fsUtils";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

export interface ProfileListCommandResult {
  profiles: string[];
}

export class ProfileListCommand {
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
        return ok({ profiles: [] });
      }

      const entries = await readdir(profilesPath, { withFileTypes: true });
      const profiles = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();

      return ok({ profiles });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err(new UserError(`Failed to read profiles directory: ${message}`, ERROR_IDS.DIRECTORY_ACCESS_FAILED));
    }
  }
}
