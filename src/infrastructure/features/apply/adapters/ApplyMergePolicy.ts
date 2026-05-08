import type { ApplyPlatformStatus } from "@/core/domain/shared/interfaces/IPlatformAdapter";

export interface ApplyMergeResult {
  status: ApplyPlatformStatus;
  content: string;
}

export class ApplyMergePolicy {
  static mergeText(existingContent: string | null, desiredContent: string, override: boolean): ApplyMergeResult {
    if (!override && existingContent !== null) {
      const normalizedExisting = ApplyMergePolicy.normalize(existingContent);
      const normalizedDesired = ApplyMergePolicy.normalize(desiredContent);
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

export function normalizeApplyContent(content: string): string {
  return content.replace(/\r\n/g, "\n").trimEnd();
}
