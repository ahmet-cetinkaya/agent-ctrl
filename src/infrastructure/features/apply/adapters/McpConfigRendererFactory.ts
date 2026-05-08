import type { IMcpConfigRenderer } from "./IMcpConfigRenderer";
import { OpenCodeMcpConfigRenderer } from "./OpenCodeMcpConfigRenderer";
import { SettingsMcpConfigRenderer } from "./SettingsMcpConfigRenderer";
import { CodexMcpConfigRenderer } from "./CodexMcpConfigRenderer";
import { ForgeCodeMcpConfigRenderer } from "./ForgeCodeMcpConfigRenderer";

/**
 * Factory for creating platform-specific MCP config renderers.
 */
export class McpConfigRendererFactory {
  private static renderers = McpConfigRendererFactory.createDefaultRenderers();

  private static createDefaultRenderers(): Map<string, IMcpConfigRenderer> {
    return new Map<string, IMcpConfigRenderer>([
      ["codex", new CodexMcpConfigRenderer()],
      ["forgecode", new ForgeCodeMcpConfigRenderer()],
      ["opencode", new OpenCodeMcpConfigRenderer()],
      ["settings", new SettingsMcpConfigRenderer()],
    ]);
  }

  static reset(): void {
    this.renderers = McpConfigRendererFactory.createDefaultRenderers();
  }

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
