import type { IAgentRenderer, ParsedAgentPrompt } from "./IAgentRenderer";

/**
 * Base renderer with shared markdown parsing utilities for agents.
 */
export abstract class BaseAgentRenderer implements IAgentRenderer {
  abstract readonly fileExtension: string;
  abstract renderAgent(source: string, id: string): string;

  /**
   * Parse markdown source to extract title, description, and body.
   */
  protected parseMarkdownPrompt(source: string, id: string): ParsedAgentPrompt {
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
   * Example: "security-auditor" → "Security Auditor"
   */
  protected humanizeSegment(value: string): string {
    return value
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
