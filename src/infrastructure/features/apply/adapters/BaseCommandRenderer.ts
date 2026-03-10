import type { ICommandRenderer, ParsedMarkdownPrompt } from "./ICommandRenderer";

/**
 * Base renderer with shared markdown parsing utilities.
 */
export abstract class BaseCommandRenderer implements ICommandRenderer {
  abstract readonly fileExtension: string;
  abstract renderCommand(source: string, id: string): string;

  /**
   * Parse markdown source to extract title, description, and body.
   */
  protected parseMarkdownPrompt(source: string, id: string): ParsedMarkdownPrompt {
    const trimmed = source.trim();
    const lines = trimmed.split(/\r?\n/);
    const firstLine = lines[0] ?? "";
    const title = firstLine.startsWith("# ") ? firstLine.replace(/^#\s+/, "").trim() : this.humanizeSegment(id);
    const body = firstLine.startsWith("# ") ? lines.slice(1).join("\n").trim() || trimmed : trimmed;
    const description =
      title
        .replace(/\b(command|workflow|agent|skill)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim() || this.humanizeSegment(id);

    return {
      title,
      description,
      body,
    };
  }

  /**
   * Convert a segment ID to human-readable text.
   * Example: "ac/lint-fix" → "Ac / Lint Fix"
   */
  protected humanizeSegment(value: string): string {
    return value
      .split("/")
      .map((segment) =>
        segment
          .split(/[-_]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      )
      .join(" / ");
  }

  /**
   * Convert command ID to name format.
   * Example: "ac/lint-fix" → "ac:lint-fix"
   */
  protected idToName(id: string): string {
    return id.replace(/\//g, ":");
  }
}
