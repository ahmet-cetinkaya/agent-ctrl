import { describe, it, expect } from "bun:test";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

describe("MCP security redaction", () => {
  it("redacts token-like values from formatted issues", () => {
    const formatter = new McpErrorFormatter();
    const issue = formatter.createIssue({
      severity: "error",
      code: "TEST",
      message: "token=super-secret-value apiKey=abc123 secret=mysecret",
      filePath: "/tmp/mcp.json",
    });

    expect(issue.message).toContain("token=[REDACTED]");
    expect(issue.message).toContain("apiKey=[REDACTED]");
    expect(issue.message).toContain("secret=[REDACTED]");
    expect(issue.message).not.toContain("super-secret-value");
    expect(issue.message).not.toContain("abc123");
    expect(issue.message).not.toContain("mysecret");
  });
});
