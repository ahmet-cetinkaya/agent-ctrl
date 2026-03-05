import type { McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";

export class McpErrorFormatter {
  createIssue(params: {
    severity: "warning" | "error";
    code: string;
    message: string;
    filePath: string;
    serverId?: string;
  }): McpIssue {
    return {
      severity: params.severity,
      code: params.code,
      message: this.sanitize(params.message),
      filePath: params.filePath,
      serverId: params.serverId,
    };
  }

  private sanitize(message: string): string {
    // Keep diagnostics actionable while avoiding common secret-like value disclosure.
    return message
      .replace(/(api[_-]?key\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]")
      .replace(/(token\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]")
      .replace(/(secret\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]");
  }
}
