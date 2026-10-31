import type { IAgentRenderer } from "./IAgentRenderer";
import { ForgeCodeAgentRenderer } from "./ForgeCodeAgentRenderer";
import { OpenCodeAgentRenderer } from "./OpenCodeAgentRenderer";
import { PiAgentRenderer } from "./PiAgentRenderer";

/**
 * Factory for creating platform-specific agent renderers.
 */
export class AgentRendererFactory {
  private static readonly opencodeRenderer = new OpenCodeAgentRenderer();
  private static readonly renderers: Record<string, IAgentRenderer> = {
    forgecode: new ForgeCodeAgentRenderer(),
    opencode: AgentRendererFactory.opencodeRenderer,
    // Kilo is an OpenCode fork sharing the same agent frontmatter schema
    // (`permission` map), so it reuses the OpenCode renderer.
    kilo: AgentRendererFactory.opencodeRenderer,
    pi: new PiAgentRenderer(),
    // The senpi / OmO Native forks keep pi's agent frontmatter schema (pi-subagents)
    // and command (prompt template) format, so they reuse the Pi renderers.
    senpi: new PiAgentRenderer(),
    omonative: new PiAgentRenderer(),
  };

  static getRenderer(platform: string): IAgentRenderer {
    const renderer = this.renderers[platform];
    if (!renderer) {
      throw new Error(`No agent renderer found for platform: ${platform}`);
    }
    return renderer;
  }
}
