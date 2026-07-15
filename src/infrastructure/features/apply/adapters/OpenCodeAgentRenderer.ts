import { isScalar, isSeq, parseDocument } from "yaml";
import { ForgeCodeAgentRenderer } from "./ForgeCodeAgentRenderer";
import type { IAgentRenderer } from "./IAgentRenderer";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/;
const TOOLS_KEY = "tools";

/**
 * OpenCode platform agent renderer.
 * Delegates id/title/description handling to ForgeCodeAgentRenderer, then
 * normalizes `tools` from a Claude-style array (e.g. ["Read", "Grep"]) into
 * the object of lowercase booleans OpenCode's config schema requires
 * (e.g. { read: true, grep: true }). See https://opencode.ai/docs/agents/.
 */
export class OpenCodeAgentRenderer implements IAgentRenderer {
  readonly fileExtension = ".md";
  private readonly baseRenderer = new ForgeCodeAgentRenderer();

  renderAgent(source: string, id: string): string {
    const rendered = this.baseRenderer.renderAgent(source, id);
    return this.normalizeToolsField(rendered);
  }

  private normalizeToolsField(content: string): string {
    const match = content.match(FRONTMATTER_PATTERN);
    if (!match) {
      return content;
    }

    const [, frontmatterText, rest = ""] = match;
    const doc = parseDocument(frontmatterText);
    if (doc.errors.length > 0) {
      // Malformed frontmatter YAML — leave content untouched rather than
      // crashing on doc.toString(), which throws for documents with errors.
      return content;
    }

    const toolsNode = doc.get(TOOLS_KEY, true);
    if (!isSeq(toolsNode)) {
      return content;
    }

    const toolNames = toolsNode.items.map((item) => this.toToolName(item));
    doc.set(TOOLS_KEY, Object.fromEntries(toolNames.map((name) => [name, true])));

    return `---\n${doc.toString().trimEnd()}\n---${rest}`;
  }

  private toToolName(item: unknown): string {
    const value = isScalar(item) ? item.value : item;
    return String(value).toLowerCase();
  }
}
