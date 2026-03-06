import type { McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";

export class McpErrorFormatter {
  constructor() {}

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

  /**
   * Sanitizes error messages to prevent secret leakage in logs.
   *
   * SECURITY: This is a defense-in-depth control. Patterns are intentionally
   * conservative to avoid false positives that could obscure actionable errors.
   *
   * Redacted patterns:
   * - "api-key:", "apiKey:", "api_key:" followed by non-space value
   * - "token:" or "token=" followed by non-space value
   * - "secret:" or "secret=" followed by non-space value
   *
   * Note: This does NOT redact secret values that appear without these prefixes.
   * Callers should avoid logging raw secret values directly.
   *
   * @param message - Raw error message that may contain secret values
   * @returns Sanitized message with matched secret values replaced by [REDACTED]
   */
  private sanitize(message: string): string {
    // Keep diagnostics actionable while avoiding common secret-like value disclosure.
    // Patterns use case-insensitive matching and allow optional hyphens/underscores.
    return message
      .replace(/(api[_-]?key\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]")
      .replace(/(token\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]")
      .replace(/(secret\s*[:=]\s*)([^\s,]+)/gi, "$1[REDACTED]");
  }
}
