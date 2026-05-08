import type { IAgentRenderer } from "./IAgentRenderer";
import { ForgeCodeAgentRenderer } from "./ForgeCodeAgentRenderer";

/**
 * Factory for creating platform-specific agent renderers.
 */
export class AgentRendererFactory {
  private static readonly renderers: Record<string, IAgentRenderer> = {
    forgecode: new ForgeCodeAgentRenderer(),
  };

  static getRenderer(platform: string): IAgentRenderer {
    const renderer = this.renderers[platform];
    if (!renderer) {
      throw new Error(`No agent renderer found for platform: ${platform}`);
    }
    return renderer;
  }
}
