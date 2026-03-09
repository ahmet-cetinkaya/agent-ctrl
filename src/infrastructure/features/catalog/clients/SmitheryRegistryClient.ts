import { err, ok } from "@/core/domain/shared/value-objects/Result";
import type {
  ISmitheryRegistryClient,
  SmitherySearchParams,
  SmitherySearchResponse,
  SmitheryServerDetails,
  SmitheryServerRecord,
} from "@/core/domain/shared/interfaces/ISmitheryRegistryClient";
import { createMissingApiKeyError } from "../errors/CatalogErrors";

interface SmitheryRegistryClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class SmitheryRegistryClient implements ISmitheryRegistryClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SmitheryRegistryClientOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.AGENT_CTRL_SMITHERY_BASE_URL ??
      "https://registry.smithery.ai"
    ).replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async listServers(params: SmitherySearchParams) {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return err(createMissingApiKeyError("Smithery", "SMITHERY_API_KEY"));
    }

    const url = new URL(`${this.baseUrl}/servers`);
    if (params.query) url.searchParams.set("q", params.query);
    if (params.page) url.searchParams.set("page", String(params.page));
    if (params.pageSize) url.searchParams.set("pageSize", String(params.pageSize));

    try {
      const response = await this.fetchJson(url.toString(), apiKey);
      if (!response.success) {
        return response;
      }

      const payload = response.data;
      const servers = this.extractRecords(payload).map((entry) => this.normalizeServer(entry));
      const page = this.pickNumber(payload, ["page", "pagination.currentPage"]) ?? params.page ?? 1;
      const pageSize = this.pickNumber(payload, ["pageSize", "pagination.pageSize"]) ?? params.pageSize ?? 10;
      const totalPages = this.pickNumber(payload, ["totalPages", "pagination.totalPages"]);
      const totalCount = this.pickNumber(payload, ["totalCount", "pagination.totalCount"]);

      const result: SmitherySearchResponse = {
        servers,
        page,
        pageSize,
        totalPages,
        totalCount,
      };

      return ok(result);
    } catch (error) {
      return err(this.normalizeError(error));
    }
  }

  async getServerDetails(id: string) {
    const apiKey = this.resolveApiKey();
    if (!apiKey) {
      return err(createMissingApiKeyError("Smithery", "SMITHERY_API_KEY"));
    }

    try {
      const encodedId = encodeURIComponent(id);
      const response = await this.fetchJson(`${this.baseUrl}/servers/${encodedId}`, apiKey);
      if (!response.success) {
        return response;
      }

      const payload = response.data;
      const detail = this.normalizeServer(this.extractDetailObject(payload));
      return ok(detail as SmitheryServerDetails);
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
        return err(this.toHttpError("Smithery", response.status));
      }

      const payload = (await response.json()) as Record<string, unknown>;
      return ok(payload);
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractRecords(payload: Record<string, unknown>): Record<string, unknown>[] {
    const candidates = [payload.servers, payload.items, payload.results];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.filter(this.isObject);
      }
    }
    return [];
  }

  private extractDetailObject(payload: Record<string, unknown>): Record<string, unknown> {
    if (this.isObject(payload.server)) {
      return payload.server;
    }
    return payload;
  }

  private normalizeServer(entry: Record<string, unknown>): SmitheryServerRecord {
    const qualifiedName = this.pickString(entry, ["qualifiedName", "id", "slug", "name"]) ?? "unknown/server";
    const id = this.pickString(entry, ["qualifiedName", "id", "slug", "name"]) ?? qualifiedName;
    const displayName = this.pickString(entry, ["displayName", "name", "title"]) ?? qualifiedName;
    const description = this.pickString(entry, ["description", "summary"]);
    const capabilities = this.pickStringArray(entry, ["capabilities", "tools", "tags"]).filter(Boolean);
    const categories = this.pickStringArray(entry, ["categories", "tags"]).filter(Boolean);
    const homepage = this.pickString(entry, ["homepage", "url"]);
    const version = this.pickString(entry, ["version", "latestVersion"]);

    const deploymentUrl = this.pickDeploymentUrl(entry);
    const inferredConnection =
      this.pickString(entry, ["connection.type", "remoteType"]) ?? (deploymentUrl ? "http" : undefined);

    const rawCommand = this.pickString(entry, ["command", "launch.command", "connection.command"]);
    const rawArgs = this.pickStringArray(entry, ["args", "launch.args", "connection.args"]);
    const command = rawCommand ?? (deploymentUrl ? "npx" : undefined);
    const args = rawArgs.length > 0 ? rawArgs : deploymentUrl ? ["-y", "mcp-remote", deploymentUrl] : [];
    const envObject = this.pickRecord(entry, ["env", "launch.env", "connection.env"]);
    const configSchema = this.pickRecord(entry, ["configSchema", "schema"]);

    return {
      id,
      qualifiedName,
      displayName,
      description,
      capabilities: capabilities.length > 0 ? capabilities : this.deriveCapabilities(description),
      categories,
      version,
      homepage,
      metadata: {
        command,
        args,
        env: envObject,
        homepage,
        raw: entry,
        deploymentUrl,
        connectionType: inferredConnection,
        rawSchema: configSchema as Record<string, unknown> | undefined,
      },
    };
  }

  private pickDeploymentUrl(entry: Record<string, unknown>): string | undefined {
    const topLevel = this.pickString(entry, ["deploymentUrl", "url", "connection.url"]);
    if (topLevel) {
      return topLevel;
    }

    const connections = entry.connections;
    if (!Array.isArray(connections)) {
      return undefined;
    }

    for (const candidate of connections) {
      if (!this.isObject(candidate)) {
        continue;
      }
      const url =
        this.pickString(candidate, ["deploymentUrl", "url"]) ??
        this.pickString(candidate, ["connectionUrl", "endpoint"]);
      if (url) {
        return url;
      }
    }

    return undefined;
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
          .filter((token) => token.length > 5)
          .slice(0, 5)
      )
    );
  }

  private toHttpError(source: string, status: number): Error {
    if (status === 401) {
      return new Error(`${source} authentication failed. Check the configured API key.`);
    }
    if (status === 429) {
      return new Error(`${source} rate limit reached. Retry later or reduce request volume.`);
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

  private pickValue(object: Record<string, unknown>, keyPath: string): unknown {
    return keyPath.split(".").reduce<unknown>((current, part) => {
      if (this.isObject(current)) {
        return current[part];
      }
      return undefined;
    }, object);
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
        return value
          .map((entry) => {
            if (typeof entry === "string") {
              return entry;
            }
            if (this.isObject(entry)) {
              return this.pickString(entry, ["name", "id", "label"]);
            }
            return undefined;
          })
          .filter((entry): entry is string => typeof entry === "string");
      }
      if (typeof value === "string") {
        return [value];
      }
    }
    return [];
  }

  private pickRecord(object: Record<string, unknown>, keys: string[]): Record<string, string> | undefined {
    for (const key of keys) {
      const value = this.pickValue(object, key);
      if (this.isObject(value)) {
        const out: Record<string, string> = {};
        for (const [entryKey, entryValue] of Object.entries(value)) {
          if (typeof entryValue === "string") {
            out[entryKey] = entryValue;
          }
        }
        return out;
      }
    }
    return undefined;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private resolveApiKey(): string | undefined {
    return this.apiKey ?? process.env.SMITHERY_API_KEY ?? process.env.SMITHERY_TOKEN;
  }
}
