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
    return line.includes(":") && !line.startsWith("#") && !line.startsWith("-");
  }

  private renderWithoutFrontmatter(source: string, id: string): string {
    const parsed = this.parseMarkdownPrompt(source, id);
    return ["---", `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
  }

  /**
   * Render a source that starts with a YAML property line but has no opening `---`
   * (a common copy-paste mistake). If a closing `---` exists later, the lines before
   * it are recovered as frontmatter (preserving the user's own fields) rather than
   * being dumped verbatim into the body under a freshly id-derived description.
   */
  private renderWithMalformedFrontmatter(lines: string[], id: string): string {
    let frontmatterEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // No closing --- either — nothing to recover.
      return this.renderWithoutFrontmatter(lines.join("\n"), id);
    }

    const frontmatterLines = lines.slice(0, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);
    const updatedFrontmatter = this.ensureDescription(frontmatterLines, id, bodyLines.join("\n"));

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
