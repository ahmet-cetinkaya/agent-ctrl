import type { McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import type { McpInterpolationRef } from "@/infrastructure/features/mcp/interpolation/McpInterpolationScanner";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

export class McpPlaceholderValidation {
  private readonly formatter = new McpErrorFormatter();

  constructor() {}

  validate(
    refs: McpInterpolationRef[],
    variables: Record<string, string>,
    filePath: string,
    serverId: string,
    envExists: boolean
  ): McpIssue[] {
    const issues: McpIssue[] = [];

    if (!envExists && refs.length > 0) {
      issues.push(
        this.formatter.createIssue({
          severity: "error",
          code: "ENV_FILE_MISSING",
          message: "mcps/.env is required for placeholder resolution",
          filePath,
          serverId,
        })
      );
      return issues;
    }

    for (const ref of refs) {
      if (!(ref.variableName in variables)) {
        issues.push(
          this.formatter.createIssue({
            severity: "error",
            code: "ENV_VAR_UNRESOLVED",
            message: `Required variable ${ref.variableName} is not defined in mcps/.env`,
            filePath,
            serverId,
          })
        );
      }
    }

    return issues;
  }
}
