import type { IFileSystem } from "@/core/domain/shared/interfaces/IFileSystem";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";
import { ERROR_IDS } from "@/core/domain/shared/constants/errorIds";

export interface InitCommandOptions {
  targetPath: string;
  override?: boolean;
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
  private static readonly README_FILE = "README.md";
  private static readonly ENV_FILE = ".env";
  private static readonly ENV_EXAMPLE_FILE = ".env.example";
  private static readonly GITIGNORE_FILE = ".gitignore";
  private fileSystem: IFileSystem;

  constructor(fileSystem: IFileSystem) {
    this.fileSystem = fileSystem;
  }

  async execute(options: InitCommandOptions): Promise<Result<InitCommandResult, Error>> {
    const targetPath = this.fileSystem.resolve(options.targetPath);

    const validationResult = await this.validateDirectory(targetPath, Boolean(options.override));
    if (!validationResult.success) {
      return validationResult as Result<never, Error>;
    }

    const mcpDirectory = this.getMcpDirectoryForTarget(targetPath);
    const configRootPath = this.getConfigRootPathForTarget(targetPath);
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

    const configFiles = [
      {
        path: this.fileSystem.resolve(configRootPath, InitCommand.ENV_FILE),
        relativePath: this.getRelativePathForCreatedFile(targetPath, configRootPath, InitCommand.ENV_FILE),
        content: this.getEnvTemplate(),
      },
      {
        path: this.fileSystem.resolve(configRootPath, InitCommand.ENV_EXAMPLE_FILE),
        relativePath: this.getRelativePathForCreatedFile(targetPath, configRootPath, InitCommand.ENV_EXAMPLE_FILE),
        content: this.getEnvExampleTemplate(),
      },
      {
        path: this.fileSystem.resolve(configRootPath, InitCommand.GITIGNORE_FILE),
        relativePath: this.getRelativePathForCreatedFile(targetPath, configRootPath, InitCommand.GITIGNORE_FILE),
        content: this.getConfigGitignoreTemplate(),
      },
    ];

    for (const file of configFiles) {
      try {
        await this.fileSystem.writeFile(file.path, file.content, "utf-8");
        createdFiles.push(file.relativePath);
      } catch (error) {
        const nodeErr = error as NodeJS.ErrnoException;
        let message = `Failed to create ${file.relativePath}`;

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

    const readmePath = this.fileSystem.resolve(targetPath, InitCommand.README_FILE);
    try {
      await this.fileSystem.writeFile(readmePath, this.getReadmeTemplate(), "utf-8");
      createdFiles.push(InitCommand.README_FILE);
    } catch (error) {
      const nodeErr = error as NodeJS.ErrnoException;
      let message = "Failed to create README file";

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

  private async validateDirectory(targetPath: string, override: boolean): Promise<Result<boolean, Error>> {
    try {
      await this.fileSystem.access(targetPath);

      const entries = await this.fileSystem.readdir(targetPath);
      const nonIgnoredFiles = entries.filter((entry) => entry.name !== ".git" && entry.name !== "node_modules");

      if (nonIgnoredFiles.length > 0 && !override) {
        return err(new UserError("Directory is not empty. Re-run with --override to initialize anyway."));
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

  private getConfigRootPathForTarget(targetPath: string): string {
    const isConfigRootTarget = new RegExp(`(^|[\\\\/])${InitCommand.CONFIG_ROOT_DIR}$`).test(targetPath);
    return isConfigRootTarget ? targetPath : this.fileSystem.resolve(targetPath, InitCommand.CONFIG_ROOT_DIR);
  }

  private getRelativePathForCreatedFile(targetPath: string, configRootPath: string, filename: string): string {
    return configRootPath === targetPath ? filename : `${InitCommand.CONFIG_ROOT_DIR}/${filename}`;
  }

  private getReadmeTemplate(): string {
    return `# agent-ctrl configuration

This directory contains your agent-ctrl artifacts.
agent-ctrl is a CLI tool for managing AI agent configurations using a standard directory-based structure.
CLI tool repository: https://github.com/ahmet-cetinkaya/agent-ctrl

## Structure

- \`rules/\`: Behavioral rules in Markdown
- \`skills/\`: Skills using the SKILL.md standard
- \`agents/\`: Agent persona definitions
- \`commands/\`: Command prompt templates
- \`.agent-ctrl/mcps/\`: MCP server definitions
- \`.agent-ctrl/.env\`: SkillsMP and Smithery API credentials

## Next steps

1. Add your artifacts to the directories above.
2. Run \`agent-ctrl rule ls\`, \`agent-ctrl skill ls\`, or \`agent-ctrl agent ls\`.
3. Apply your configuration with \`agent-ctrl apply <platform>\`.
`;
  }

  private getEnvTemplate(): string {
    return `# agent-ctrl integration credentials
# Add your real API keys here. This file is ignored by .gitignore.
# SkillsMP API key: https://skillsmp.com/docs/api
# Smithery API key: https://smithery.ai/account/api-keys

SKILLSMP_API_KEY=
SMITHERY_API_KEY=
`;
  }

  private getEnvExampleTemplate(): string {
    return `# Example agent-ctrl integration credentials
# Copy these keys into .env and populate them with real values.
# SkillsMP API key: https://skillsmp.com/docs/api
# Smithery API key: https://smithery.ai/account/api-keys

SKILLSMP_API_KEY=your-skillsmp-api-key
SMITHERY_API_KEY=your-smithery-api-key
`;
  }

  private getConfigGitignoreTemplate(): string {
    return `# Local secrets for agent-ctrl catalog integrations
.env
`;
  }
}
