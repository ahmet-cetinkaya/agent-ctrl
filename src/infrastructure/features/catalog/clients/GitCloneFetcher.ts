import { exec } from "node:child_process";
import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { err, ok, type Result } from "@/core/domain/shared/value-objects/Result";
import {
  createGitCloneFailedError,
  createGitNotInstalledError,
  createSkillMdNotFoundError,
} from "../errors/GitSkillErrors";

const execAsync = promisify(exec);

export interface GitCloneSkillDetails {
  id: string;
  name: string;
  description?: string;
  skillMarkdown: string;
  files: Record<string, string>;
}

export class GitCloneFetcher {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 60_000) {
    this.timeoutMs = timeoutMs;
  }

  async fetchAll(repoUrl: string, ref: string, path: string): Promise<Result<GitCloneSkillDetails, Error>> {
    const cloneDir = join("/tmp", `agent-ctrl-skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    try {
      await this.checkGitInstalled();
      await this.cloneRepository(repoUrl, ref, path, cloneDir);
      const files = await this.readDirectory(cloneDir, path);

      const skillMarkdown = files["SKILL.md"] ?? files["skill.md"];
      if (!skillMarkdown) {
        return err(createSkillMdNotFoundError(path));
      }

      const metadata = this.parseFrontmatter(skillMarkdown);
      const skillId = this.extractIdFromUrl(repoUrl, path);

      return ok({
        id: skillId,
        name: metadata.name ?? this.extractNameFromPath(path),
        description: metadata.description,
        skillMarkdown,
        files,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("git not found")) {
        return err(createGitNotInstalledError());
      }
      return err(
        error instanceof Error
          ? createGitCloneFailedError(repoUrl, error.message)
          : createGitCloneFailedError(repoUrl, String(error))
      );
    } finally {
      await rm(cloneDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async checkGitInstalled(): Promise<void> {
    try {
      await execAsync("git --version");
    } catch {
      throw new Error("git not found");
    }
  }

  private async cloneRepository(repoUrl: string, ref: string, skillPath: string, cloneDir: string): Promise<void> {
    await mkdir(cloneDir, { recursive: true });

    await execAsync(
      `git clone --depth 1 --filter=blob:none --sparse --branch ${this.escapeShell(ref)} ${this.escapeShell(repoUrl)} ${this.escapeShell(cloneDir)}`,
      { timeout: this.timeoutMs }
    );

    await execAsync(`git -C ${this.escapeShell(cloneDir)} sparse-checkout set ${this.escapeShell(skillPath)}`, {
      timeout: this.timeoutMs,
    });
  }

  private async readDirectory(cloneDir: string, skillPath: string): Promise<Record<string, string>> {
    const targetDir = join(cloneDir, skillPath);
    const files: Record<string, string> = {};

    await this.readDirRecursive(targetDir, targetDir, files);

    return files;
  }

  private async readDirRecursive(currentDir: string, baseDir: string, files: Record<string, string>): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.readDirRecursive(fullPath, baseDir, files);
      } else if (entry.isFile()) {
        const content = await readFile(fullPath, "utf-8");
        const relativePath = relative(baseDir, fullPath);
        files[relativePath] = content;
      }
    }
  }

  private parseFrontmatter(markdown: string): { name?: string; description?: string } {
    const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return {};
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descriptionMatch = frontmatter.match(/^description:\s*(.+)$/m);

    return {
      name: nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, "") : undefined,
      description: descriptionMatch ? descriptionMatch[1].trim().replace(/^["']|["']$/g, "") : undefined,
    };
  }

  private extractIdFromUrl(repoUrl: string, path: string): string {
    try {
      const url = new URL(repoUrl);
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      const repoPath = parts.slice(0, 2).join("/");
      return `${repoPath}/${path}`;
    } catch {
      return `${repoUrl}/${path}`;
    }
  }

  private extractNameFromPath(path: string): string {
    const parts = path.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "unknown-skill";
  }

  private escapeShell(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}
