import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { type ProfileMetadata, UNCATEGORIZED_CATEGORY } from "@/core/domain/shared/entities/Profile";

const PROFILE_METADATA_FILENAME = "profile.yaml";

export interface ProfileMetadataReadResult {
  metadata: ProfileMetadata;
  warnings: string[];
}

/**
 * Reads optional display metadata from `<profileDir>/profile.yaml`.
 *
 * A profile without a metadata file is a normal case, not an error: the reader
 * resolves to a ProfileMetadata with sensible fallbacks and never throws. A
 * profile.yaml that exists but fails to read or parse is a genuine problem
 * the caller should surface, so it is reported via `warnings` rather than
 * being silently indistinguishable from "no file".
 */
export class ProfileMetadataReader {
  async read(profileDirPath: string, dirName: string): Promise<ProfileMetadataReadResult> {
    const metadataPath = resolve(profileDirPath, PROFILE_METADATA_FILENAME);

    let content: string;
    try {
      content = await readFile(metadataPath, "utf-8");
    } catch (error) {
      if (this.isMissingFile(error)) {
        return { metadata: this.fallback(dirName), warnings: [] };
      }
      return {
        metadata: this.fallback(dirName),
        warnings: [`Profile '${dirName}': failed to read profile.yaml: ${this.describeError(error)}`],
      };
    }

    let raw: unknown;
    try {
      raw = parseYaml(content);
    } catch (error) {
      return {
        metadata: this.fallback(dirName),
        warnings: [`Profile '${dirName}': malformed profile.yaml: ${this.describeError(error)}`],
      };
    }

    if (raw === null || typeof raw !== "object") {
      return { metadata: this.fallback(dirName), warnings: [] };
    }

    const record = raw as Record<string, unknown>;
    const tags = this.readTags(record.tags);

    return {
      metadata: {
        displayName: this.readString(record.name) ?? dirName,
        description: this.readString(record.description) ?? "",
        tags,
        category: tags.length > 0 ? tags[0] : UNCATEGORIZED_CATEGORY,
      },
      warnings: [],
    };
  }

  private isMissingFile(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === "ENOENT";
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private fallback(dirName: string): ProfileMetadata {
    return {
      displayName: dirName,
      description: "",
      tags: [],
      category: UNCATEGORIZED_CATEGORY,
    };
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private readTags(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
}
