import { BaseCommandRenderer } from "./BaseCommandRenderer";

/**
 * Workflow platform command renderer.
 * Passes through source content unchanged.
 */
export class WorkflowCommandRenderer extends BaseCommandRenderer {
  readonly fileExtension = ".md";

  constructor() {
    super();
  }

  renderCommand(source: string, _id: string): string {
    return source.trimEnd();
  }
}
