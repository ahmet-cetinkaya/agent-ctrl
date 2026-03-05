import type { McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";
import { McpErrorFormatter } from "@/infrastructure/features/mcp/reporting/McpErrorFormatter";

export interface McpConflictCandidate {
  serverId: string;
  filePath: string;
}

export class McpServerConflictValidator {
  private readonly formatter = new McpErrorFormatter();

  findConflicts(candidates: McpConflictCandidate[]): Map<string, McpIssue[]> {
    const byServer = new Map<string, McpConflictCandidate[]>();

    for (const candidate of candidates) {
      const existing = byServer.get(candidate.serverId) ?? [];
      existing.push(candidate);
      byServer.set(candidate.serverId, existing);
    }

    const issuesByCandidate = new Map<string, McpIssue[]>();

    for (const [serverId, entries] of byServer.entries()) {
      if (entries.length <= 1) {
        continue;
      }

      for (const entry of entries) {
        const others = entries.filter((item) => item.filePath !== entry.filePath).map((item) => item.filePath);
        const issue = this.formatter.createIssue({
          severity: "error",
          code: "MCP_SERVER_CONFLICT",
          message: `Duplicate mcpServers key '${serverId}' also defined in: ${others.join(", ")}`,
          filePath: entry.filePath,
          serverId,
        });

        const key = this.makeKey(entry.filePath, entry.serverId);
        const existingIssues = issuesByCandidate.get(key) ?? [];
        existingIssues.push(issue);
        issuesByCandidate.set(key, existingIssues);
      }
    }

    return issuesByCandidate;
  }

  makeKey(filePath: string, serverId: string): string {
    return `${filePath}::${serverId}`;
  }
}
