import type { ICommandRenderer } from "./ICommandRenderer";
import { OpenCodeCommandRenderer } from "./OpenCodeCommandRenderer";
import { GeminiCommandRenderer } from "./GeminiCommandRenderer";
import { WorkflowCommandRenderer } from "./WorkflowCommandRenderer";
import { ForgeCodeCommandRenderer } from "./ForgeCodeCommandRenderer";

/**
 * Factory for creating platform-specific command renderers.
 */
export class CommandRendererFactory {
  private static renderers = CommandRendererFactory.createDefaultRenderers();

  private static createDefaultRenderers(): Map<string, ICommandRenderer> {
    return new Map<string, ICommandRenderer>([
      ["forgecode", new ForgeCodeCommandRenderer()],
      ["gemini", new GeminiCommandRenderer()],
      ["opencode", new OpenCodeCommandRenderer()],
      ["workflow", new WorkflowCommandRenderer()],
    ]);
  }

  static reset(): void {
    this.renderers = CommandRendererFactory.createDefaultRenderers();
  }

  static getRenderer(platform: string): ICommandRenderer {
    const renderer = this.renderers.get(platform);
    if (!renderer) {
      throw new Error(`No command renderer registered for platform: ${platform}`);
    }
    return renderer;
  }

  static registerRenderer(platform: string, renderer: ICommandRenderer): void {
    this.renderers.set(platform, renderer);
  }
}
