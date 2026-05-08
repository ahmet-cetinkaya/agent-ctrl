import type { ApplyMergeResult } from "@/infrastructure/features/apply/adapters/ApplyMergePolicy";
import { normalizeApplyContent } from "@/infrastructure/features/apply/adapters/ApplyMergePolicy";

export interface ManagedTextSectionMarkers {
  start: string;
  end: string;
}

export function mergeManagedTextSection(
  existingContent: string | null,
  sectionBody: string,
  markers: ManagedTextSectionMarkers
): ApplyMergeResult {
  const nextContent = upsertManagedTextSection(existingContent, sectionBody, markers);
  const currentContent = existingContent ?? "";

  return {
    status: normalizeApplyContent(currentContent) === normalizeApplyContent(nextContent) ? "unchanged" : "success",
    content: nextContent,
  };
}

function upsertManagedTextSection(
  existingContent: string | null,
  sectionBody: string,
  markers: ManagedTextSectionMarkers
): string {
  const managedBlock = [markers.start, sectionBody.trim(), markers.end].join("\n");

  if (!existingContent || existingContent.trim().length === 0) {
    return `${managedBlock}\n`;
  }

  if (existingContent.includes(markers.start) && existingContent.includes(markers.end)) {
    const replaced = existingContent.replace(
      new RegExp(`${escapeForRegex(markers.start)}[\\s\\S]*?${escapeForRegex(markers.end)}`, "m"),
      managedBlock
    );
    return `${replaced.trimEnd()}\n`;
  }

  return `${existingContent.trimEnd()}\n\n${managedBlock}\n`;
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
