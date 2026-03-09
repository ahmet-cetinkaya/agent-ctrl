import type { AppyMergeResult } from "@/infrastructure/features/apply/adapters/AppyMergePolicy";
import { normalizeAppyContent } from "@/infrastructure/features/apply/adapters/AppyMergePolicy";

export interface ManagedTextSectionMarkers {
  start: string;
  end: string;
}

export function mergeManagedTextSection(
  existingContent: string | null,
  sectionBody: string,
  markers: ManagedTextSectionMarkers
): AppyMergeResult {
  const nextContent = upsertManagedTextSection(existingContent, sectionBody, markers);
  const currentContent = existingContent ?? "";

  return {
    status: normalizeAppyContent(currentContent) === normalizeAppyContent(nextContent) ? "unchanged" : "success",
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
