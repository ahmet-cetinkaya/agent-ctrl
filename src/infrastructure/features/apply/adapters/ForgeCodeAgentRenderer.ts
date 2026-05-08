import { BaseAgentRenderer } from "./BaseAgentRenderer";
import type { IAgentRenderer } from "./IAgentRenderer";

/**
 * ForgeCode platform agent renderer.
 * Renders agents as markdown with YAML frontmatter (id, title, description).
 * Format: ---\nid: <id>\ntitle: <title>\ndescription: <description>\n---\n<body>
 */
export class ForgeCodeAgentRenderer extends BaseAgentRenderer implements IAgentRenderer {
  readonly fileExtension = ".md";

  renderAgent(source: string, id: string): string {
    const trimmed = source.trimStart();
    const lines = trimmed.split(/\r?\n/);

    // Parse title and description from source
    const parsed = this.parseMarkdownPrompt(source, id);

    // Check if file has frontmatter (starts with ---)
    if (trimmed.startsWith("---")) {
      return this.renderWithExistingFrontmatter(lines, id, parsed);
    }

    // Check if file has malformed frontmatter (starts with "key: value" pattern but no opening ---)
    const firstLine = lines[0] || "";
    if (this.isYamlPropertyLine(firstLine)) {
      return this.renderWithMalformedFrontmatter(lines, id, parsed);
    }

    // No frontmatter - add it with id, title, description
    return [
      "---",
      `id: ${id}`,
      `title: ${parsed.title}`,
      `description: ${parsed.description}`,
      "---",
      "",
      parsed.body,
    ].join("\n");
  }

  /**
   * Check if a line looks like a YAML property (key: value format).
   */
  private isYamlPropertyLine(line: string): boolean {
    return line.includes(":") && !line.startsWith("#") && !line.startsWith("-");
  }

  /**
   * Render file that has existing frontmatter.
   */
  private renderWithExistingFrontmatter(
    lines: string[],
    id: string,
    parsed: ReturnType<typeof this.parseMarkdownPrompt>
  ): string {
    // Find end of frontmatter (second ---)
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // Malformed frontmatter (no closing ---)
      return [
        "---",
        `id: ${id}`,
        `title: ${parsed.title}`,
        `description: ${parsed.description}`,
        "---",
        "",
        parsed.body,
      ].join("\n");
    }

    // Extract frontmatter and body
    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);

    // Update id, title, and description properties
    const updatedFrontmatter = this.updateAgentFrontmatter(frontmatterLines, id, parsed);

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  /**
   * Render file that has malformed frontmatter (no opening ---).
   */
  private renderWithMalformedFrontmatter(
    lines: string[],
    id: string,
    parsed: ReturnType<typeof this.parseMarkdownPrompt>
  ): string {
    // Find closing ---
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd > 0) {
      // Has malformed frontmatter - fix it by adding opening --- and updating id, title, description
      const frontmatterLines = lines.slice(0, frontmatterEnd);
      const bodyLines = lines.slice(frontmatterEnd + 1);
      const updatedFrontmatter = this.updateAgentFrontmatter(frontmatterLines, id, parsed);
      return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
    }

    // No frontmatter found, create new
    return [
      "---",
      `id: ${id}`,
      `title: ${parsed.title}`,
      `description: ${parsed.description}`,
      "---",
      "",
      parsed.body,
    ].join("\n");
  }

  /**
   * Update or add id, title, and description properties in frontmatter.
   */
  private updateAgentFrontmatter(
    frontmatterLines: string[],
    id: string,
    parsed: ReturnType<typeof this.parseMarkdownPrompt>
  ): string[] {
    const result = [...frontmatterLines];
    let idFound = false;
    let titleFound = false;
    let descriptionFound = false;

    for (let i = 0; i < result.length; i++) {
      const line = result[i];
      if (line.match(/^id:\s*/)) {
        result[i] = `id: ${id}`;
        idFound = true;
      } else if (line.match(/^title:\s*/)) {
        result[i] = `title: ${parsed.title}`;
        titleFound = true;
      } else if (line.match(/^description:\s*/)) {
        result[i] = `description: ${parsed.description}`;
        descriptionFound = true;
      }
    }

    if (!idFound) {
      result.unshift(`id: ${id}`);
    }
    if (!titleFound) {
      result.unshift(`title: ${parsed.title}`);
    }
    if (!descriptionFound) {
      result.unshift(`description: ${parsed.description}`);
    }

    return result;
  }
}
