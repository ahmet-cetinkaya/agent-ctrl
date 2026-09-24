import { BaseCommandRenderer } from "./BaseCommandRenderer";

/**
 * Pi platform command renderer.
 * Pi discovers custom commands as "prompt templates" under a `prompts/` directory.
 * Each file becomes a `/name` command where the name is derived from the filename,
 * not from frontmatter. Frontmatter only carries a `description` (Pi also supports an
 * `argument-hint` field, but agent-ctrl's command sources carry no such metadata today).
 */
export class PiCommandRenderer extends BaseCommandRenderer {
  readonly fileExtension = ".md";

  renderCommand(source: string, id: string): string {
    const trimmed = source.trimStart();
    const lines = trimmed.split(/\r?\n/);

    if (trimmed.startsWith("---")) {
      return this.renderWithExistingFrontmatter(lines, id);
    }

    const firstLine = lines[0] || "";
    if (this.isYamlPropertyLine(firstLine)) {
      return this.renderWithMalformedFrontmatter(lines, id);
    }

    return this.renderWithoutFrontmatter(source, id);
  }

  private isYamlPropertyLine(line: string): boolean {
    return /^[A-Za-z][A-Za-z0-9_-]*:\s/.test(line);
  }

  private renderWithoutFrontmatter(source: string, id: string): string {
    const parsed = this.parseMarkdownPrompt(source, id);
    return ["---", `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
  }

  /**
   * Render a source that starts with a YAML property line but has no opening `---`
   * (a common copy-paste mistake). The closing `---` only counts as a frontmatter
   * delimiter when EVERY line before it is a `key: value` property — a `---`
   * preceded by plain prose (e.g. a body that happens to start with "Time: 10 min"
   * and contains a horizontal rule) is body content, not frontmatter.
   */
  private renderWithMalformedFrontmatter(lines: string[], id: string): string {
    let frontmatterEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    const candidateLines = frontmatterEnd > 0 ? lines.slice(0, frontmatterEnd) : [];
    const allProperties = candidateLines.length > 0 && candidateLines.every((line) => this.isYamlPropertyLine(line));

    if (frontmatterEnd === -1 || !allProperties) {
      // No closing --- before real prose — treat the whole source as body.
      return this.renderWithoutFrontmatter(lines.join("\n"), id);
    }

    const bodyLines = lines.slice(frontmatterEnd + 1);
    const updatedFrontmatter = this.ensureDescription(candidateLines, id, bodyLines.join("\n"));

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  private renderWithExistingFrontmatter(lines: string[], id: string): string {
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // Malformed frontmatter (no closing ---)
      return this.renderWithoutFrontmatter(lines.join("\n"), id);
    }

    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);
    const updatedFrontmatter = this.ensureDescription(frontmatterLines, id, bodyLines.join("\n"));

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  private ensureDescription(frontmatterLines: string[], id: string, body: string): string[] {
    const hasDescription = frontmatterLines.some((line) => /^description:\s*/.test(line));
    if (hasDescription) {
      return frontmatterLines;
    }
    const parsed = this.parseMarkdownPrompt(body, id);
    return [...frontmatterLines, `description: ${parsed.description}`];
  }
}
