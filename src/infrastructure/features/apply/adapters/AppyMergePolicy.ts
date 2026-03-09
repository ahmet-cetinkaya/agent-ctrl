import type { ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export interface AppyMergeResult {
  status: ApplyPlatformStatus;
  content: string;
}

export class AppyMergePolicy {
  constructor() {}

  static mergeText(existingContent: string | null, desiredContent: string, override: boolean): AppyMergeResult {
    if (!override && existingContent !== null) {
      const normalizedExisting = AppyMergePolicy.normalize(existingContent);
      const normalizedDesired = AppyMergePolicy.normalize(desiredContent);
      if (normalizedExisting === normalizedDesired) {
        return {
          status: "unchanged",
          content: existingContent,
        };
      }
    }

    return {
      status: "success",
      content: desiredContent,
    };
  }

  private static normalize(content: string): string {
    return content.replace(/\r\n/g, "\n").trimEnd();
  }
}

export function normalizeAppyContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trimEnd();
}
