import type { IAgentRenderer } from "./IAgentRenderer";
import { ForgeCodeAgentRenderer } from "./ForgeCodeAgentRenderer";
import { OpenCodeAgentRenderer } from "./OpenCodeAgentRenderer";

/**
 * Factory for creating platform-specific agent renderers.
 */
export class AgentRendererFactory {
  private static readonly opencodeRenderer = new OpenCodeAgentRenderer();
  private static readonly renderers: Record<string, IAgentRenderer> = {
    forgecode: new ForgeCodeAgentRenderer(),
    opencode: AgentRendererFactory.opencodeRenderer,
    // Kilo is an OpenCode fork sharing the same agent frontmatter schema
    // (tools as a boolean map), so it reuses the OpenCode renderer.
    kilo: AgentRendererFactory.opencodeRenderer,
  };

  static getRenderer(platform: string): IAgentRenderer {
    const renderer = this.renderers[platform];
    if (!renderer) {
      throw new Error(`No agent renderer found for platform: ${platform}`);
    }
    return renderer;
  }
}
