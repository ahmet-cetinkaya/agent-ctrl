import type { IFileSystem } from "../../../../../core/domain/shared/interfaces/IFileSystem";
import { Result, ok, err } from "../../../../../core/domain/shared/value-objects/Result";
import { UserError } from "../../../../../core/domain/shared/errors/UserError";
import { SystemError } from "../../../../../core/domain/shared/errors/SystemError";

export interface InitCommandOptions {
  targetPath: string;
}

export interface InitCommandResult {
  createdDirectories: string[];
  createdFiles: string[];
}

export class InitCommand {
  private static readonly DIRECTORIES = ["rules", "skills", "agents", "commands"];
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

    const createdDirs: string[] = [];
    for (const dir of InitCommand.DIRECTORIES) {
      const dirPath = this.fileSystem.resolve(targetPath, dir);
      try {
        await this.fileSystem.mkdir(dirPath, { recursive: true });
        createdDirs.push(dir);
      } catch (error) {
        return err(new SystemError(`Permission denied: cannot create directory ${dir}`));
      }
    }

    const configPath = this.fileSystem.resolve(targetPath, InitCommand.CONFIG_FILE);
    try {
      const configContent = await this.getConfigTemplate();
      await this.fileSystem.writeFile(configPath, configContent, "utf-8");
    } catch (error) {
      return err(new SystemError(`Permission denied: cannot create config file`));
    }

    return ok({
      createdDirectories: createdDirs,
      createdFiles: [InitCommand.CONFIG_FILE],
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
      return ok(true);
    }
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
