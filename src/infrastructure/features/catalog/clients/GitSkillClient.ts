import { err, ok, type Result } from "@/core/domain/shared/value-objects/Result";
import { createInvalidGitUrlError } from "../errors/GitSkillErrors";
import { GitHubContentsFetcher, type GitHubSkillDetails } from "./GitHubContentsFetcher";
import { GitCloneFetcher, type GitCloneSkillDetails } from "./GitCloneFetcher";

export interface GitSkillDetails {
  id: string;
  name: string;
  description?: string;
  skillMarkdown: string;
  files: Record<string, string>;
}

interface ParsedGitUrl {
  provider: "github" | "other";
  repoUrl: string;
  owner?: string;
  repo?: string;
  ref: string;
  path: string;
}

export class GitSkillClient {
  private readonly githubFetcher: GitHubContentsFetcher;
  private readonly cloneFetcher: GitCloneFetcher;

  constructor(options: { githubTimeoutMs?: number; cloneTimeoutMs?: number } = {}) {
    this.githubFetcher = new GitHubContentsFetcher(options.githubTimeoutMs);
    this.cloneFetcher = new GitCloneFetcher(options.cloneTimeoutMs);
  }

  async getSkillDetails(ref: string): Promise<Result<GitSkillDetails, Error>> {
    const parsed = this.parseRef(ref);
    if (!parsed.success) {
      return parsed;
    }

    const url = parsed.data;

    if (url.provider === "github" && url.owner && url.repo) {
      const result = await this.githubFetcher.fetchAll(url.owner, url.repo, url.ref, url.path);
      if (!result.success) {
        return result;
      }
      return ok(this.mapGitHubDetails(result.data));
    }

    const result = await this.cloneFetcher.fetchAll(url.repoUrl, url.ref, url.path);
    if (!result.success) {
      return result;
    }
    return ok(this.mapCloneDetails(result.data));
  }

  private parseRef(ref: string): Result<ParsedGitUrl, Error> {
    const urlStr = ref.replace(/^git:/, "").trim();

    if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
      return err(createInvalidGitUrlError(ref, "URL must start with http:// or https://"));
    }

    try {
      const url = new URL(urlStr);
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");

      if (parts.length < 4) {
        return err(createInvalidGitUrlError(ref, "URL must contain owner/repo/tree/ref/path"));
      }

      const [owner, repo, _treeOrSrc, branchRef, ...pathParts] = parts;

      if (!owner || !repo || !branchRef) {
        return err(createInvalidGitUrlError(ref, "Invalid URL structure"));
      }

      const path = pathParts.join("/");
      const isGitHub = url.hostname === "github.com";

      return ok({
        provider: isGitHub ? "github" : "other",
        repoUrl: urlStr,
        owner: isGitHub ? owner : undefined,
        repo: isGitHub ? repo : undefined,
        ref: branchRef,
        path,
      });
    } catch (error) {
      return err(createInvalidGitUrlError(ref, error instanceof Error ? error.message : String(error)));
    }
  }

  private mapGitHubDetails(details: GitHubSkillDetails): GitSkillDetails {
    return {
      id: details.id,
      name: details.name,
      description: details.description,
      skillMarkdown: details.skillMarkdown,
      files: details.files,
    };
  }

  private mapCloneDetails(details: GitCloneSkillDetails): GitSkillDetails {
    return {
      id: details.id,
      name: details.name,
      description: details.description,
      skillMarkdown: details.skillMarkdown,
      files: details.files,
    };
  }
}
