import { err, ok, type Result } from "@/core/domain/shared/value-objects/Result";
import { createGitHubRepoNotAccessibleError, createSkillMdNotFoundError } from "../errors/GitSkillErrors";

interface GitHubFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url?: string;
  sha: string;
  size: number;
}

export interface GitHubSkillDetails {
  id: string;
  name: string;
  description?: string;
  skillMarkdown: string;
  files: Record<string, string>;
}

export class GitHubContentsFetcher {
  private readonly timeoutMs: number;

  constructor(timeoutMs = 30_000) {
    this.timeoutMs = timeoutMs;
  }

  async fetchAll(owner: string, repo: string, ref: string, path: string): Promise<Result<GitHubSkillDetails, Error>> {
    const files: Record<string, string> = {};
    const errors: string[] = [];

    try {
      await this.fetchDirectoryRecursive(owner, repo, ref, path, files, errors);
    } catch (error) {
      return err(error instanceof Error ? error : createGitHubRepoNotAccessibleError(owner, repo, String(error)));
    }

    if (errors.length > 0) {
      console.warn(`Warning: Partial fetch failures: ${errors.join("; ")}`);
    }

    const skillMarkdown = files["SKILL.md"] ?? files["skill.md"];
    if (!skillMarkdown) {
      return err(createSkillMdNotFoundError(path));
    }

    const metadata = this.parseFrontmatter(skillMarkdown);

    return ok({
      id: `${owner}/${repo}/${path}`,
      name: metadata.name ?? this.extractNameFromPath(path),
      description: metadata.description,
      skillMarkdown,
      files,
    });
  }

  private async fetchDirectoryRecursive(
    owner: string,
    repo: string,
    ref: string,
    currentPath: string,
    files: Record<string, string>,
    errors: string[]
  ): Promise<void> {
    const entries = await this.fetchDirectory(owner, repo, ref, currentPath);
    if (!entries.success) {
      errors.push(`Failed to list ${currentPath}: ${entries.error.message}`);
      return;
    }

    for (const entry of entries.data) {
      if (entry.type === "dir") {
        await this.fetchDirectoryRecursive(owner, repo, ref, entry.path, files, errors);
      } else if (entry.type === "file" && entry.download_url) {
        const content = await this.fetchFile(entry.download_url);
        if (!content.success) {
          errors.push(`Failed to download ${entry.path}: ${content.error.message}`);
        } else {
          const rootPrefix = currentPath ? `${currentPath}/` : "";
          const relativePath =
            rootPrefix && entry.path.startsWith(rootPrefix)
              ? entry.path.slice(rootPrefix.length)
              : (entry.path.split("/").pop() ?? entry.path);
          files[relativePath] = content.data;
        }
      }
    }
  }

  private async fetchDirectory(
    owner: string,
    repo: string,
    ref: string,
    path: string
  ): Promise<Result<GitHubFileEntry[], Error>> {
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(ref)}`;

    try {
      const response = await this.fetchWithTimeout(url, {
        headers: this.buildHeaders("application/vnd.github+json"),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return err(createGitHubRepoNotAccessibleError(owner, repo, `HTTP ${response.status}: ${body.slice(0, 200)}`));
      }

      const data = (await response.json()) as GitHubFileEntry | GitHubFileEntry[];
      return ok(Array.isArray(data) ? data : [data]);
    } catch (error) {
      return err(error instanceof Error ? error : new Error(`Failed to fetch directory: ${String(error)}`));
    }
  }

  private async fetchFile(url: string): Promise<Result<string, Error>> {
    try {
      const response = await this.fetchWithTimeout(url, {
        headers: this.buildHeaders("text/plain"),
      });

      if (!response.ok) {
        return err(new Error(`HTTP ${response.status}`));
      }

      return ok(await response.text());
    } catch (error) {
      return err(error instanceof Error ? error : new Error(`Failed to fetch file: ${String(error)}`));
    }
  }

  private buildHeaders(accept: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      "User-Agent": "agent-ctrl",
    };

    const githubToken = process.env.GITHUB_TOKEN?.trim();
    if (githubToken) {
      headers.Authorization = `Bearer ${githubToken}`;
    }

    return headers;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
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

  private extractNameFromPath(path: string): string {
    const parts = path.split("/").filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : "unknown-skill";
  }
}
