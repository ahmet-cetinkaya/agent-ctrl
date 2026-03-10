import { BaseCommandRenderer } from "./BaseCommandRenderer";

/**
 * OpenCode platform command renderer.
 * Renders commands as markdown with YAML frontmatter.
 */
export class OpenCodeCommandRenderer extends BaseCommandRenderer {
  readonly fileExtension = ".md";

  renderCommand(source: string, id: string): string {
    const trimmed = source.trimStart();
    const lines = trimmed.split(/\r?\n/);
    const name = this.idToName(id);

    // Check if the file has frontmatter (starts with ---)
    if (trimmed.startsWith("---")) {
      return this.renderWithExistingFrontmatter(lines, id, name);
    }

    // Check if the file has malformed frontmatter (starts with "key: value" pattern but no opening ---)
    const firstLine = lines[0] || "";
    if (this.isYamlPropertyLine(firstLine)) {
      return this.renderWithMalformedFrontmatter(lines, name);
    }

    // No frontmatter - add it
    const parsed = this.parseMarkdownPrompt(source, id);
    return ["---", `name: ${name}`, `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
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
  private renderWithExistingFrontmatter(lines: string[], _id: string, name: string): string {
    // Find the end of frontmatter (second ---)
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // Malformed frontmatter (no closing ---)
      const parsed = this.parseMarkdownPrompt(lines.join("\n"), _id);
      return ["---", `name: ${name}`, `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
    }

    // Extract frontmatter and body
    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);

    // Update the name property
    const updatedFrontmatter = this.updateFrontmatterName(frontmatterLines, name);

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  /**
   * Render file that has malformed frontmatter (no opening ---).
   */
  private renderWithMalformedFrontmatter(lines: string[], name: string): string {
    // Find the closing ---
    let frontmatterEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd > 0) {
      // Has malformed frontmatter - fix it by adding opening --- and updating name
      const frontmatterLines = lines.slice(0, frontmatterEnd);
      const bodyLines = lines.slice(frontmatterEnd + 1);
      const updatedFrontmatter = this.updateFrontmatterName(frontmatterLines, name);
      return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
    }

    // No frontmatter found, create new - derive ID from name (reverse of idToName)
    const id = name.replace(/:/g, "/");
    const parsed = this.parseMarkdownPrompt(lines.join("\n"), id);
    return ["---", `name: ${name}`, `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
  }

  /**
   * Update or add the name property in the frontmatter.
   */
  private updateFrontmatterName(frontmatterLines: string[], name: string): string[] {
    const result = [...frontmatterLines];
    let nameFound = false;

    for (let i = 0; i < result.length; i++) {
      const line = result[i];
      if (line.match(/^name:\s*/)) {
        result[i] = `name: ${name}`;
        nameFound = true;
        break;
      }
    }

    if (!nameFound) {
      result.unshift(`name: ${name}`);
    }

    return result;
  }
}
