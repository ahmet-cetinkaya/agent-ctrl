/**
 * Interface for platform-specific command rendering.
 */
export interface ICommandRenderer {
  /**
   * Render a command source to the platform-specific format.
   * @param source The raw command source content
   * @param id The command identifier (e.g., "ac/lint-fix")
   * @returns The rendered content in platform-specific format
   */
  renderCommand(source: string, id: string): string;

  /**
   * Get the file extension for commands in this platform.
   */
  readonly fileExtension: string;
}

/**
 * Parsed markdown prompt data.
 */
export interface ParsedMarkdownPrompt {
  title: string;
  description: string;
  body: string;
}
