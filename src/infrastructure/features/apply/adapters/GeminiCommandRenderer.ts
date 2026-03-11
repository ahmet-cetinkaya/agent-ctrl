import { BaseCommandRenderer } from "./BaseCommandRenderer";

/**
 * Gemini platform command renderer.
 * Renders commands as TOML format.
 */
export class GeminiCommandRenderer extends BaseCommandRenderer {
  readonly fileExtension = ".toml";

  constructor() {
    super();
  }

  renderCommand(source: string, id: string): string {
    const parsed = this.parseMarkdownPrompt(source, id);
    return [
      `description = ${JSON.stringify(parsed.description)}`,
      'prompt = """',
      parsed.body.replace(/"""/g, '\\"\\"\\"'),
      '"""',
    ].join("\n");
  }
}
