import { resolve } from "node:path";
import { PathSecurity } from "./PathSecurity";

export class PathResolver {
  private projectRoot: string;
  private security: PathSecurity;

  constructor(projectRoot: string) {
    this.projectRoot = resolve(projectRoot);
    this.security = new PathSecurity(projectRoot);
  }

  resolve(absoluteOrRelativePath: string): string {
    const validation = this.security.resolveSafe(absoluteOrRelativePath);
    if (!validation.safe) {
      throw new Error(validation.error);
    }
    return validation.path;
  }

  isWithinProject(targetPath: string): boolean {
    return this.security.isWithinProject(targetPath);
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }

  getRulesPath(): string {
    return resolve(this.projectRoot, "rules");
  }

  getSkillsPath(): string {
    return resolve(this.projectRoot, "skills");
  }

  getAgentsPath(): string {
    return resolve(this.projectRoot, "agents");
  }

  getCommandsPath(): string {
    return resolve(this.projectRoot, "commands");
  }
}
