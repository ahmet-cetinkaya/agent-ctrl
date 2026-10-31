import { isMap, isScalar, isSeq, parseDocument } from "yaml";
import { ForgeCodeAgentRenderer } from "./ForgeCodeAgentRenderer";
import type { IAgentRenderer } from "./IAgentRenderer";

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/;
const TOOLS_KEY = "tools";
const PERMISSION_KEY = "permission";
const DENY_ALL_RULE = "*";
const MCP_PREFIX = "mcp__";
const MCP_SEPARATOR = "__";

// Claude tool names that OpenCode folds into a different permission key.
// `edit` covers edit, write and patch (https://opencode.ai/docs/permissions/).
const PERMISSION_KEY_BY_CLAUDE_TOOL: Record<string, string> = {
  write: "edit",
  multiedit: "edit",
  notebookedit: "edit",
  agent: "task",
};

/**
 * OpenCode platform agent renderer.
 * Delegates id/title/description handling to ForgeCodeAgentRenderer, then
 * turns a Claude-style `tools` allowlist (e.g. ["Read", "Grep"]) into a
 * `permission` map. OpenCode's `tools` field is deprecated and only toggles
 * the tools it names, so an allowlist must deny everything first and allow the
 * listed tools after it (last matching rule wins).
 * See https://opencode.ai/docs/agents/ and https://opencode.ai/docs/permissions/.
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

    const existingPermission = doc.get(PERMISSION_KEY, true);
    const permission: Record<string, unknown> = { [DENY_ALL_RULE]: "deny" };
    for (const item of toolsNode.items) {
      permission[this.toPermissionKey(item)] = "allow";
    }
    // Explicit rules written by the author come last so they win.
    if (isMap(existingPermission)) {
      Object.assign(permission, existingPermission.toJSON());
    }

    doc.delete(TOOLS_KEY);
    doc.set(PERMISSION_KEY, permission);

    return `---\n${doc.toString().trimEnd()}\n---${rest}`;
  }

  private toPermissionKey(item: unknown): string {
    const name = String(isScalar(item) ? item.value : item);
    if (name.startsWith(MCP_PREFIX)) {
      // OpenCode names MCP tools `<server>_<tool>`, Claude `mcp__<server>__<tool>`.
      return name.slice(MCP_PREFIX.length).replace(MCP_SEPARATOR, "_");
    }
    const lowerName = name.toLowerCase();
    return PERMISSION_KEY_BY_CLAUDE_TOOL[lowerName] ?? lowerName;
  }
}
