import { BaseAgentRenderer } from "./BaseAgentRenderer";
import type { IAgentRenderer, ParsedAgentPrompt } from "./IAgentRenderer";

/**
 * Pi platform agent renderer.
 *
 * Pi's core has no native persona/subagent format, but the most widely adopted community
 * extension (`pi-subagents`) reads `.pi/agents/*.md` files with `name` (required) and
 * `description` frontmatter, followed by the system prompt body. This renderer is only
 * invoked when that extension is detected as installed — see `PiAdapter.isPackageInstalled()`.
 * Otherwise agents are degraded to skills (`syncAgentsAsSkills`) and this renderer is unused.
 */
export class PiAgentRenderer extends BaseAgentRenderer implements IAgentRenderer {
  readonly fileExtension = ".md";

  renderAgent(source: string, id: string): string {
    const trimmed = source.trimStart();
    const lines = trimmed.split(/\r?\n/);
    const parsed = this.parseMarkdownPrompt(source, id);

    if (trimmed.startsWith("---")) {
      return this.renderWithExistingFrontmatter(lines, id, parsed);
    }

    const firstLine = lines[0] || "";
    if (this.isYamlPropertyLine(firstLine)) {
      return this.renderWithMalformedFrontmatter(lines, id, parsed);
    }

    return this.renderWithNewFrontmatter(id, parsed);
  }

  private isYamlPropertyLine(line: string): boolean {
    return line.includes(":") && !line.startsWith("#") && !line.startsWith("-");
  }

  private renderWithNewFrontmatter(id: string, parsed: ParsedAgentPrompt): string {
    return ["---", `name: ${id}`, `description: ${parsed.description}`, "---", "", parsed.body].join("\n");
  }

  private renderWithExistingFrontmatter(lines: string[], id: string, parsed: ParsedAgentPrompt): string {
    let frontmatterEnd = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // Malformed frontmatter (no closing ---)
      return this.renderWithNewFrontmatter(id, parsed);
    }

    const frontmatterLines = lines.slice(1, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);
    const updatedFrontmatter = this.updateAgentFrontmatter(frontmatterLines, id, parsed);

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  /**
   * Render a source that starts with a YAML property line but has no opening `---`.
   * If a closing `---` exists later, the lines before it are recovered as frontmatter
   * (preserving the user's own fields, e.g. `tools`/`model`) rather than being dumped
   * verbatim into the body under a freshly derived name/description.
   */
  private renderWithMalformedFrontmatter(lines: string[], id: string, parsed: ParsedAgentPrompt): string {
    let frontmatterEnd = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        frontmatterEnd = i;
        break;
      }
    }

    if (frontmatterEnd === -1) {
      // No closing --- either — nothing to recover.
      return this.renderWithNewFrontmatter(id, parsed);
    }

    const frontmatterLines = lines.slice(0, frontmatterEnd);
    const bodyLines = lines.slice(frontmatterEnd + 1);
    const updatedFrontmatter = this.updateAgentFrontmatter(frontmatterLines, id, parsed);

    return ["---", ...updatedFrontmatter, "---", ...bodyLines].join("\n");
  }

  /**
   * Ensure `name` matches the true id (corrected in place if present, since a stale
   * `name` would break pi-subagents' ability to reference the agent by its file-derived
   * identifier) and that `description` exists — but an already-authored `description` is
   * left untouched rather than overwritten with a derived fallback. Every other field
   * (e.g. `tools`, `model`, `systemPromptMode`) is preserved verbatim.
   */
  private updateAgentFrontmatter(frontmatterLines: string[], id: string, parsed: ParsedAgentPrompt): string[] {
    const result = [...frontmatterLines];
    let nameFound = false;
    let descriptionFound = false;

    for (let i = 0; i < result.length; i++) {
      const line = result[i];
      if (line.match(/^name:\s*/)) {
        result[i] = `name: ${id}`;
        nameFound = true;
      } else if (line.match(/^description:\s*/)) {
        descriptionFound = true;
      }
    }

    if (!descriptionFound) {
      result.push(`description: ${parsed.description}`);
    }
    if (!nameFound) {
      result.unshift(`name: ${id}`);
    }

    return result;
  }
}
