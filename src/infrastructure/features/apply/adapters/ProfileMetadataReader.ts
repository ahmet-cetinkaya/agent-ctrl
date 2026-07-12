import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { type ProfileMetadata, UNCATEGORIZED_CATEGORY } from "@/core/domain/shared/entities/Profile";

const PROFILE_METADATA_FILENAME = "profile.yaml";

/**
 * Reads optional display metadata from `<profileDir>/profile.yaml`.
 *
 * A profile without a metadata file (or with malformed/partial metadata) is a
 * normal case, not an error: the reader always resolves to a ProfileMetadata
 * with sensible fallbacks and never throws.
 */
export class ProfileMetadataReader {
  async read(profileDirPath: string, dirName: string): Promise<ProfileMetadata> {
    const metadataPath = resolve(profileDirPath, PROFILE_METADATA_FILENAME);

    let raw: unknown;
    try {
      const content = await readFile(metadataPath, "utf-8");
      raw = parseYaml(content);
    } catch {
      return this.fallback(dirName);
    }

    if (raw === null || typeof raw !== "object") {
      return this.fallback(dirName);
    }

    const record = raw as Record<string, unknown>;
    const tags = this.readTags(record.tags);

    return {
      displayName: this.readString(record.name) ?? dirName,
      description: this.readString(record.description) ?? "",
      tags,
      category: tags.length > 0 ? tags[0] : UNCATEGORIZED_CATEGORY,
    };
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
