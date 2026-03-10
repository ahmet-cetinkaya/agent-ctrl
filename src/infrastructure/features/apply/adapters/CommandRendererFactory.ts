import type { ICommandRenderer } from "./ICommandRenderer";
import { OpenCodeCommandRenderer } from "./OpenCodeCommandRenderer";
import { GeminiCommandRenderer } from "./GeminiCommandRenderer";
import { WorkflowCommandRenderer } from "./WorkflowCommandRenderer";

/**
 * Factory for creating platform-specific command renderers.
 */
export class CommandRendererFactory {
  private static renderers = new Map<string, ICommandRenderer>([
    ["opencode", new OpenCodeCommandRenderer()],
    ["gemini", new GeminiCommandRenderer()],
    ["workflow", new WorkflowCommandRenderer()],
  ]);

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
