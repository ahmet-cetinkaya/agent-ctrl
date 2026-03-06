import type { IFileSystem } from "@/core/domain/shared/interfaces/IFileSystem";
import { Result, ok, err } from "@/core/domain/shared/value-objects/Result";
import { UserError } from "@/core/domain/shared/errors/UserError";
import { SystemError } from "@/core/domain/shared/errors/SystemError";

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
        return err(new SystemError(`Permission denied: cannot create directory ${dir}`));
      }

      const gitkeepPath = this.fileSystem.resolve(dirPath, InitCommand.GITKEEP_FILE);
      try {
        await this.fileSystem.writeFile(gitkeepPath, "", "utf-8");
        createdFiles.push(`${dir}/${InitCommand.GITKEEP_FILE}`);
      } catch (error) {
        return err(new SystemError(`Permission denied: cannot create ${InitCommand.GITKEEP_FILE} in directory ${dir}`));
      }
    }

    const configPath = this.fileSystem.resolve(targetPath, InitCommand.CONFIG_FILE);
    try {
      const configContent = await this.getConfigTemplate();
      await this.fileSystem.writeFile(configPath, configContent, "utf-8");
      createdFiles.push(InitCommand.CONFIG_FILE);
    } catch (error) {
      return err(new SystemError(`Permission denied: cannot create config file`));
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
      return ok(true);
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
