import type { IMcpConfigRenderer } from "./IMcpConfigRenderer";
import { OpenCodeMcpConfigRenderer } from "./OpenCodeMcpConfigRenderer";
import { SettingsMcpConfigRenderer } from "./SettingsMcpConfigRenderer";
import { CodexMcpConfigRenderer } from "./CodexMcpConfigRenderer";

/**
 * Factory for creating platform-specific MCP config renderers.
 */
export class McpConfigRendererFactory {
  private static renderers = new Map<string, IMcpConfigRenderer>([
    ["opencode", new OpenCodeMcpConfigRenderer()],
    ["settings", new SettingsMcpConfigRenderer()],
    ["codex", new CodexMcpConfigRenderer()],
  ]);

  static getRenderer(platform: string): IMcpConfigRenderer {
    const renderer = this.renderers.get(platform);
    if (!renderer) {
      throw new Error(`No MCP config renderer registered for platform: ${platform}`);
    }
    return renderer;
  }

  static registerRenderer(platform: string, renderer: IMcpConfigRenderer): void {
    this.renderers.set(platform, renderer);
  }
}
