import { err, ok } from "@/core/domain/shared/value-objects/Result";
import type {
  ISkillsMpClient,
  SkillsMpSearchParams,
  SkillsMpSearchResponse,
  SkillsMpSkillDetails,
  SkillsMpSkillRecord,
} from "@/core/domain/shared/interfaces/ISkillsMpClient";
import { createMissingApiKeyError } from "../errors/CatalogErrors";

interface SkillsMpClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

interface GitHubTreeLocation {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export class SkillsMpClient implements ISkillsMpClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SkillsMpClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.AGENT_CTRL_SKILLSMP_BASE_URL ?? "https://skillsmp.com").replace(
      /\/$/,
      ""
    );
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async search(params: SkillsMpSearchParams) {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return err(createMissingApiKeyError("SkillsMP", "SKILLSMP_API_KEY"));
    }

    const endpoint = params.ai ? "/api/v1/skills/ai-search" : "/api/v1/skills/search";
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.set("q", params.query);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.category) url.searchParams.set("category", params.category);

    try {
      const response = await this.fetchJson(url.toString(), apiKey);
      if (!response.success) {
        return response;
      }

      const payload = response.data.payload;
      const skills = this.extractRecords(payload).map((entry) => this.normalizeSkill(entry));
      const page = this.pickNumber(payload, ["page", "currentPage", "pagination.currentPage"]) ?? params.page ?? 1;
      const limit =
        this.pickNumber(payload, ["limit", "pageSize", "pagination.pageSize"]) ??
        params.limit ??
        (skills.length > 0 ? skills.length : 20);
      const total = this.pickNumber(payload, ["total", "totalCount", "pagination.totalCount"]);
      const rateLimit = {
        dailyLimit: response.data.headers.get("X-RateLimit-Daily-Limit")
          ? Number(response.data.headers.get("X-RateLimit-Daily-Limit"))
          : undefined,
        dailyRemaining: response.data.headers.get("X-RateLimit-Daily-Remaining")
          ? Number(response.data.headers.get("X-RateLimit-Daily-Remaining"))
          : undefined,
      };

      const result: SkillsMpSearchResponse = {
        skills,
        page,
        limit,
        total,
        rateLimit,
      };

      return ok(result);
    } catch (error) {
      return err(this.normalizeError(error));
    }
  }

  async getSkillDetails(skillId: string, hint?: SkillsMpSkillRecord) {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return err(createMissingApiKeyError("SkillsMP", "SKILLSMP_API_KEY"));
    }

    try {
      const hinted = hint;
      const hintedInstallation = hinted ? await this.fetchInstallationFromRepository(hinted) : undefined;
      if (hinted && hintedInstallation) {
        return ok({
          id: hinted.id,
          name: hinted.name,
          description: hinted.description,
          capabilities: hinted.capabilities,
          categories: hinted.categories,
          version: hinted.version,
          sourceUrl: hinted.sourceUrl,
          installation: hintedInstallation,
          metadata: {
            ...(hinted.metadata ?? {}),
            installation: hintedInstallation,
          },
        });
      }

      const candidatesResult = await this.searchSkillCandidates(skillId);
      if (!candidatesResult.success) {
        return candidatesResult;
      }
      const exact = this.findExactCandidate(skillId, candidatesResult.data);

      const repositoryInstallation = exact ? await this.fetchInstallationFromRepository(exact) : undefined;
      if (repositoryInstallation && exact) {
        return ok({
          id: exact.id,
          name: exact.name,
          description: exact.description,
          capabilities: exact.capabilities,
          categories: exact.categories,
          version: exact.version,
          sourceUrl: exact.sourceUrl,
          installation: repositoryInstallation,
          metadata: {
            ...(exact.metadata ?? {}),
            installation: repositoryInstallation,
          },
        });
      }

      const slugFallbackRecord = this.buildRepositoryFallbackRecord(skillId);
      if (slugFallbackRecord) {
        const slugFallbackInstallation = await this.fetchInstallationFromRepository(slugFallbackRecord);
        if (slugFallbackInstallation) {
          return ok({
            id: slugFallbackRecord.id,
            name: slugFallbackRecord.name,
            description: slugFallbackRecord.description,
            capabilities: slugFallbackRecord.capabilities,
            categories: slugFallbackRecord.categories,
            version: slugFallbackRecord.version,
            sourceUrl: slugFallbackRecord.sourceUrl,
            installation: slugFallbackInstallation,
            metadata: {
              ...(slugFallbackRecord.metadata ?? {}),
              installation: slugFallbackInstallation,
            },
          });
        }
      }

      const detailUrl = exact?.sourceUrl ?? `${this.baseUrl}/skills/${skillId}`;
      const detailResponse = await this.fetchText(detailUrl, apiKey);
      if (!detailResponse.success) {
        if (exact) {
          return ok({ ...exact, installation: exact.metadata?.installation });
        }
        return detailResponse;
      }

      if (this.isCloudflareBlockPage(detailResponse.data) && exact) {
        return ok({ ...exact, installation: exact.metadata?.installation });
      }

      const detail = this.enrichFromHtml(exact ?? this.createFallbackSkill(skillId), detailResponse.data, detailUrl);
      return ok(detail);
    } catch (error) {
      return err(this.normalizeError(error));
    }
  }

  private async fetchJson(url: string, apiKey: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return err(this.toHttpError("SkillsMP", response.status));
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return ok({ payload, headers: response.headers });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchText(url: string, apiKey: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/html, text/plain;q=0.9, application/json;q=0.8",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 403 && url.includes("/skills/")) {
          return err(
            new Error(
              "SkillsMP detail page access was blocked (HTTP 403). The skill may be undiscoverable via API search from this environment."
            )
          );
        }
        return err(this.toHttpError("SkillsMP", response.status));
      }

      return ok(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
    const candidates = [payload.skills, payload.items, payload.results, this.pickObject(payload, ["data"])?.skills];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(this.isObject);
      }
    }
    return [];
  }

  private normalizeSkill(entry: Record<string, unknown>): SkillsMpSkillRecord {
    const id =
      this.pickString(entry, ["id", "slug", "identifier", "sourceId"]) ??
      this.slugify(this.pickString(entry, ["name", "title"]) ?? "unknown-skill");
    const name = this.pickString(entry, ["name", "title", "displayName"]) ?? id;
    const description = this.pickString(entry, ["description", "summary", "excerpt"]);
    const capabilities = this.pickStringArray(entry, ["capabilities", "tags"]).filter(Boolean);
    const categories = this.pickStringArray(entry, ["categories", "category", "tags"]).filter(Boolean);
    const version = this.pickString(entry, ["version", "latestVersion"]);
    const sourceUrl =
      this.pickString(entry, ["url", "sourceUrl", "homepage", "skillUrl"]) ?? `${this.baseUrl}/skills/${id}`;
    const repository = this.pickString(entry, ["repository", "repo", "githubRepo", "githubUrl"]);
    const downloadUrl = this.pickString(entry, ["downloadUrl", "download_url", "zipUrl"]);
    const author = this.pickString(entry, ["author"]);

    return {
      id,
      name,
      description,
      capabilities: capabilities.length > 0 ? capabilities : this.deriveCapabilities(description),
      categories,
      version,
      sourceUrl,
      metadata: {
        author,
        repository,
        downloadUrl,
        raw: entry,
      },
    };
  }

  private enrichFromHtml(base: SkillsMpSkillRecord, html: string, url: string): SkillsMpSkillDetails {
    const markdownMatch = html.match(/<pre[^>]*>\s*#\s*([^<]+)[\s\S]*?<\/pre>/i);
    const descriptionMatch = html.match(/description\|([^|<\n]+)/i);
    const repositoryMatch =
      html.match(/&quot;repository&quot;:&quot;([^&]+)&quot;/i) ?? html.match(/repository\|([^|<\n]+)/i);
    const downloadMatch = html.match(/wget\s+([^\s"']+skill\.zip)/i);

    const installation = markdownMatch
      ? {
          skillMarkdown: this.decodeEntities(markdownMatch[0].replace(/<[^>]+>/g, "").trim()),
        }
      : undefined;

    return {
      ...base,
      description: base.description ?? (descriptionMatch ? this.decodeEntities(descriptionMatch[1].trim()) : undefined),
      sourceUrl: url,
      metadata: {
        ...base.metadata,
        repository:
          base.metadata?.repository ?? (repositoryMatch ? this.decodeEntities(repositoryMatch[1].trim()) : undefined),
        downloadUrl: base.metadata?.downloadUrl ?? (downloadMatch ? downloadMatch[1].trim() : undefined),
        installation,
        raw: {
          ...(base.metadata?.raw ?? {}),
          detailHtmlFetched: true,
        },
      },
      installation,
    };
  }

  private createFallbackSkill(skillId: string): SkillsMpSkillRecord {
    return {
      id: skillId,
      name: skillId,
      capabilities: [],
      categories: [],
      sourceUrl: `${this.baseUrl}/skills/${skillId}`,
      metadata: {},
    };
  }

  private async fetchInstallationFromRepository(
    record: SkillsMpSkillRecord
  ): Promise<SkillsMpSkillDetails["installation"] | undefined> {
    const repositoryUrl = this.resolveRepositoryUrl(record);
    if (!repositoryUrl) {
      return undefined;
    }

    const location = this.parseGitHubTreeUrl(repositoryUrl);
    if (!location) {
      return undefined;
    }

    const files = await this.fetchGitHubDirectoryFiles(location);
    if (Object.keys(files).length === 0) {
      return undefined;
    }

    return {
      skillMarkdown: files["SKILL.md"],
      files,
    };
  }

  private resolveRepositoryUrl(record: SkillsMpSkillRecord): string | undefined {
    const raw = record.metadata?.raw;
    if (raw && this.isObject(raw) && typeof raw.githubUrl === "string" && raw.githubUrl.trim().length > 0) {
      return raw.githubUrl.trim();
    }
    return record.metadata?.repository;
  }

  private async searchSkillCandidates(skillId: string) {
    const queries = Array.from(
      new Set(
        [skillId.trim(), this.pickSlugKeyword(skillId)].filter((value): value is string =>
          Boolean(value && value.trim().length > 0)
        )
      )
    );

    const byId = new Map<string, SkillsMpSkillRecord>();
    for (const query of queries) {
      const limit = query === skillId ? 50 : 100;
      const result = await this.search({ query, limit });
      if (!result.success) {
        return result;
      }
      for (const skill of result.data.skills) {
        byId.set(skill.id, skill);
      }
    }

    return ok(Array.from(byId.values()));
  }

  private findExactCandidate(skillId: string, candidates: SkillsMpSkillRecord[]): SkillsMpSkillRecord | undefined {
    return (
      candidates.find((skill) => skill.id === skillId) ??
      candidates.find((skill) => skill.name === skillId) ??
      candidates.find((skill) => skill.sourceUrl?.endsWith(`/skills/${skillId}`))
    );
  }

  private pickSlugKeyword(skillId: string): string | undefined {
    const normalized = skillId.trim().toLowerCase();
    if (!normalized.includes("-")) {
      return undefined;
    }

    const parts = normalized.split("-").filter(Boolean);
    if (parts.length < 3) {
      return undefined;
    }

    const excluded = new Set(["skill", "skills", "md", "openclaw", "claude", "agent", "plugin", "plugins"]);
    const preferred = [...parts].reverse().find((part) => part.length > 2 && !excluded.has(part));
    return preferred ?? parts[parts.length - 1];
  }

  private buildRepositoryFallbackRecord(skillId: string): SkillsMpSkillRecord | undefined {
    const normalized = skillId.trim().toLowerCase();
    const parts = normalized.split("-").filter(Boolean);
    if (parts.length < 5) {
      return undefined;
    }

    const owner = parts[0];
    const repo = parts[1];
    const tail = parts.slice(2);

    if (tail.length < 3 || tail[tail.length - 2] !== "skill" || tail[tail.length - 1] !== "md") {
      return undefined;
    }

    const pathParts = tail.slice(0, -2);
    if (pathParts.length === 0) {
      return undefined;
    }

    const defaultName = pathParts[pathParts.length - 1];
    const guessedUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tree/main/${pathParts
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`;

    return {
      id: normalized,
      name: defaultName,
      description: undefined,
      capabilities: this.deriveCapabilities(defaultName),
      categories: [],
      version: undefined,
      sourceUrl: `${this.baseUrl}/skills/${normalized}`,
      metadata: {
        author: owner,
        repository: guessedUrl,
        raw: {
          resolver: "slug-repository-fallback",
          sourceSkillId: skillId,
        },
      },
    };
  }

  private parseGitHubTreeUrl(urlString: string): GitHubTreeLocation | undefined {
    try {
      const url = new URL(urlString);
      if (url.hostname !== "github.com") {
        return undefined;
      }

      const parts = url.pathname
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .map((part) => decodeURIComponent(part));
      if (parts.length < 4) {
        return undefined;
      }

      const [owner, repo, kind, ref, ...pathParts] = parts;
      if (!owner || !repo || !ref || (kind !== "tree" && kind !== "blob")) {
        return undefined;
      }

      return {
        owner,
        repo: repo.replace(/\.git$/i, ""),
        ref,
        path: pathParts.join("/"),
      };
    } catch {
      return undefined;
    }
  }

  private async fetchGitHubDirectoryFiles(location: GitHubTreeLocation): Promise<Record<string, string>> {
    const queue = [location.path];
    const files: Record<string, string> = {};
    const errors: string[] = [];
    const failedFiles: string[] = [];

    while (queue.length > 0) {
      const currentPath = queue.shift() ?? "";
      const listingResult = await this.fetchPublicJson(this.buildGitHubContentsUrl(location, currentPath));
      if (!listingResult.success) {
        errors.push(`GitHub API failed for ${currentPath}: ${listingResult.error.message}`);
        continue;
      }

      const entries = Array.isArray(listingResult.data) ? listingResult.data : [listingResult.data];
      for (const entry of entries) {
        if (!this.isObject(entry)) {
          continue;
        }

        const type = typeof entry.type === "string" ? entry.type : undefined;
        const entryPath = typeof entry.path === "string" ? entry.path : undefined;
        if (!type || !entryPath) {
          continue;
        }

        if (type === "dir") {
          queue.push(entryPath);
          continue;
        }

        if (type !== "file") {
          continue;
        }

        const downloadUrl = typeof entry.download_url === "string" ? entry.download_url : undefined;
        if (!downloadUrl) {
          continue;
        }

        const fileResult = await this.fetchPublicText(downloadUrl);
        if (!fileResult.success) {
          failedFiles.push(entryPath);
          continue;
        }

        const rootPrefix = location.path ? `${location.path}/` : "";
        const relativePath =
          rootPrefix && entryPath.startsWith(rootPrefix)
            ? entryPath.slice(rootPrefix.length)
            : (entryPath.split("/").pop() ?? entryPath);
        files[relativePath] = fileResult.data;
      }
    }

    if (errors.length > 0) {
      console.warn(`Warning: Partial GitHub fetch failure: ${errors.join("; ")}`);
    }

    if (failedFiles.length > 0) {
      const criticalFiles = ["SKILL.md", "skill.md", "README.md", "readme.md"];
      const missingCritical = failedFiles.filter(f =>
        criticalFiles.some(cf => f.toLowerCase().endsWith(cf))
      );
      if (missingCritical.length > 0) {
        console.warn(`Warning: Failed to download critical files: ${missingCritical.join(", ")}`);
      }
    }

    return files;
  }

  private buildGitHubContentsUrl(location: GitHubTreeLocation, currentPath: string): string {
    const encodedPath = currentPath
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const basePath = encodedPath ? `/${encodedPath}` : "";
    return `https://api.github.com/repos/${encodeURIComponent(location.owner)}/${encodeURIComponent(location.repo)}/contents${basePath}?ref=${encodeURIComponent(location.ref)}`;
  }

  private async fetchPublicJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: this.buildPublicHeaders("application/vnd.github+json, application/json;q=0.9"),
        signal: controller.signal,
      });

      if (!response.ok) {
        return err(new Error(`Public source request failed with HTTP ${response.status}.`));
      }

      return ok((await response.json()) as Record<string, unknown> | Array<Record<string, unknown>>);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchPublicText(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: this.buildPublicHeaders("text/plain, text/markdown;q=0.9, */*;q=0.1"),
        signal: controller.signal,
      });

      if (!response.ok) {
        return err(new Error(`Public source request failed with HTTP ${response.status}.`));
      }

      return ok(await response.text());
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildPublicHeaders(accept: string): Record<string, string> {
    const githubToken = process.env.GITHUB_TOKEN?.trim();

    return {
      Accept: accept,
      "User-Agent": "agent-ctrl",
      ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
    };
  }

  private isCloudflareBlockPage(html: string): boolean {
    const normalized = html.toLowerCase();
    return (
      normalized.includes("attention required! | cloudflare") || normalized.includes("sorry, you have been blocked")
    );
  }

  private deriveCapabilities(description?: string): string[] {
    if (!description) {
      return [];
    }
    return Array.from(
      new Set(
        description
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((token) => token.length > 4)
          .slice(0, 5)
      )
    );
  }

  private toHttpError(source: string, status: number): Error {
    if (status === 401 || status === 403) {
      return new Error(`${source} authentication failed. Check the configured API key.`);
    }
    if (status === 429) {
      return new Error(`${source} rate limit or quota reached. Retry later or reduce refresh scope.`);
    }
    return new Error(`${source} request failed with HTTP ${status}.`);
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        return new Error(`Request timed out after ${this.timeoutMs}ms`);
      }
      return error;
    }
    return new Error(String(error));
  }

  private pickString(object: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.pickValue(object, key);
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private pickNumber(object: Record<string, unknown>, keys: string[]): number | undefined {
    for (const key of keys) {
      const value = this.pickValue(object, key);
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
        return Number(value);
      }
    }
    return undefined;
  }

  private pickStringArray(object: Record<string, unknown>, keys: string[]): string[] {
    for (const key of keys) {
      const value = this.pickValue(object, key);
      if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === "string");
      }
      if (typeof value === "string") {
        return [value];
      }
    }
    return [];
  }

  private pickObject(object: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
    for (const key of keys) {
      const value = this.pickValue(object, key);
      if (this.isObject(value)) {
        return value;
      }
    }
    return undefined;
  }

  private pickValue(object: Record<string, unknown>, keyPath: string): unknown {
    return keyPath.split(".").reduce<unknown>((current, part) => {
      if (this.isObject(current)) {
        return current[part];
      }
      return undefined;
    }, object);
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private decodeEntities(value: string): string {
    return value
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&#x3C;/g, "<")
      .replace(/&#x3E;/g, ">");
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? process.env.SKILLSMP_API_KEY ?? process.env.SKILLSMP_TOKEN;
  }
}
