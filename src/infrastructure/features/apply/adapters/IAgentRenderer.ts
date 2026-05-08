/**
 * Interface for platform-specific agent rendering.
 */
export interface IAgentRenderer {
  /**
   * Render an agent source to the platform-specific format.
   * @param source The raw agent source content
   * @param id The agent identifier (e.g., "security-auditor")
   * @returns The rendered content in platform-specific format
   */
  renderAgent(source: string, id: string): string;

  /**
   * Get the file extension for agents in this platform.
   */
  readonly fileExtension: string;
}

/**
 * Parsed markdown prompt data for agents.
 */
export interface ParsedAgentPrompt {
  title: string;
  description: string;
  body: string;
}
