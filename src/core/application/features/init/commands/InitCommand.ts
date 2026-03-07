import type { IFileSystem } from "@/core/domain/shared/interfaces/IFileSystem";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

export interface InitCommandOptions {
  targetPath: string;
}

export interface InitCommandResult {
  createdDirectories: string[];
  createdFiles: string[];
}

export class InitCommand {
  private static readonly BASE_DIRECTORIES = ["rules", "skills", "agents", "commands"];
  private static readonly CONFIG_ROOT_DIR = ".agent-ctrl";
  private static readonly MCP_DIR = "mcps";
  private static readonly GITKEEP_FILE = ".gitkeep";
  private static readonly CONFIG_FILE = "agent-ctrl.config.json";
  private fileSystem: IFileSystem;

  constructor(fileSystem: IFileSystem) {
    this.fileSystem = fileSystem;
  }

  async execute(options: InitCommandOptions): Promise<Result<InitCommandResult, Error>> {
    const targetPath = this.fileSystem.resolve(options.targetPath);

    const validationResult = await this.validateDirectory(targetPath);
    if (!validationResult.success) {
      return validationResult as Result<never, Error>;
    }

    const mcpDirectory = this.getMcpDirectoryForTarget(targetPath);
    const directories = this.getDirectoriesForTarget(mcpDirectory);
    const createdDirs: string[] = [];
    const createdFiles: string[] = [];
    for (const dir of directories) {
      const dirPath = this.fileSystem.resolve(targetPath, dir);
      try {
        await this.fileSystem.mkdir(dirPath, { recursive: true });
        createdDirs.push(dir);
      } catch (error) {
        const nodeErr = error as NodeJS.ErrnoException;
        let message = `Failed to create directory ${dir}`;

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

        return err(new SystemError(message, ERROR_IDS.DIRECTORY_CREATE_FAILED));
      }

      const gitkeepPath = this.fileSystem.resolve(dirPath, InitCommand.GITKEEP_FILE);
      try {
        await this.fileSystem.writeFile(gitkeepPath, "", "utf-8");
        createdFiles.push(`${dir}/${InitCommand.GITKEEP_FILE}`);
      } catch (error) {
        const nodeErr = error as NodeJS.ErrnoException;
        let message = `Failed to create ${InitCommand.GITKEEP_FILE} in directory ${dir}`;

        if (nodeErr.code === "EACCES") {
          message += ": Permission denied. Check file/directory permissions.";
        } else if (nodeErr.code === "ENOSPC") {
          message += ": No space left on device. Free up disk space and try again.";
        } else if (nodeErr.code === "EROFS") {
          message += ": Filesystem is read-only. Cannot write to this location.";
        } else if (error instanceof Error) {
          message += `: ${error.message}`;
        } else {
          message += `: ${String(error)}`;
        }

        return err(new SystemError(message, ERROR_IDS.FILE_WRITE_FAILED));
      }
    }

    const configPath = this.fileSystem.resolve(targetPath, InitCommand.CONFIG_FILE);
    try {
      const configContent = await this.getConfigTemplate();
      await this.fileSystem.writeFile(configPath, configContent, "utf-8");
      createdFiles.push(InitCommand.CONFIG_FILE);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = "Failed to create config file";

      if (nodeErr.code === "EACCES") {
        message += ": Permission denied. Check file/directory permissions.";
      } else if (nodeErr.code === "ENOSPC") {
        message += ": No space left on device. Free up disk space and try again.";
      } else if (nodeErr.code === "EROFS") {
        message += ": Filesystem is read-only. Cannot write to this location.";
      } else if (error instanceof Error) {
        message += `: ${error.message}`;
      } else {
        message += `: ${String(error)}`;
      }

      return err(new SystemError(message, ERROR_IDS.FILE_WRITE_FAILED));
    }

    return ok({
      createdDirectories: createdDirs,
      createdFiles,
    });
  }

  private async validateDirectory(targetPath: string): Promise<Result<boolean, Error>> {
    try {
      await this.fileSystem.access(targetPath);

      const entries = await this.fileSystem.readdir(targetPath);
      const nonIgnoredFiles = entries.filter((entry) => entry.name !== ".git" && entry.name !== "node_modules");

      if (nonIgnoredFiles.length > 0) {
        return err(new UserError("Directory is not empty. Please initialize in an empty directory."));
      }

      return ok(true);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;

      // ENOENT is expected - directory doesn't exist yet
      if (nodeErr.code === "ENOENT") {
        return ok(true);
      }

      // Any other error is a real problem
      let message = "Failed to validate target directory";
      if (nodeErr.code === "EACCES") {
        message += ": Permission denied accessing this location.";
      } else if (error instanceof Error) {
        message += `: ${error.message}`;
      } else {
        message += `: ${String(error)}`;
      }

      return err(new SystemError(message, ERROR_IDS.DIRECTORY_ACCESS_FAILED));
    }
  }

  private getDirectoriesForTarget(mcpDirectory: string): string[] {
    return [...InitCommand.BASE_DIRECTORIES, mcpDirectory];
  }

  private getMcpDirectoryForTarget(targetPath: string): string {
    const isConfigRootTarget = new RegExp(`(^|[\\\\/])${InitCommand.CONFIG_ROOT_DIR}$`).test(targetPath);
    return isConfigRootTarget ? InitCommand.MCP_DIR : `${InitCommand.CONFIG_ROOT_DIR}/${InitCommand.MCP_DIR}`;
  }

  private async getConfigTemplate(): Promise<string> {
    const config = {
      _comment: "agent-ctrl configuration file - Define your AI agent project structure",
      version: "1.0.0",
      project: {
        name: "my-agent-project",
        description: "Configure AI agent behaviors, skills, and personas",
      },
      artifacts: {
        rules: {
          description: "Behavioral rules for AI agents (Markdown files)",
        },
        skills: {
          description: "Reusable capabilities following SKILL.md standard",
        },
        agents: { description: "Agent persona definitions" },
        commands: { description: "Command prompt templates" },
      },
    };
    return JSON.stringify(config, null, 2);
  }
}
