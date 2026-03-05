import type { McpFileResult, McpLoadReport, McpIssue } from "@/core/domain/shared/interfaces/IMcpConfigLoader";

export class McpLoadReportBuilder {
  createFileResult(filePath: string): McpFileResult {
    return {
      filePath,
      status: "skipped",
      loadedServerCount: 0,
      failedServerCount: 0,
      issues: [],
    };
  }

  addIssue(fileResult: McpFileResult, issue: McpIssue): void {
    fileResult.issues.push(issue);
  }

  finalizeFileResult(fileResult: McpFileResult): McpFileResult {
    if (fileResult.failedServerCount > 0) {
      fileResult.status = "failed";
      return fileResult;
    }

    if (fileResult.loadedServerCount > 0) {
      fileResult.status = "loaded";
      return fileResult;
    }

    fileResult.status = "skipped";
    return fileResult;
  }

  buildReport(startedAt: Date, finishedAt: Date, totalDiscovered: number, fileResults: McpFileResult[]): McpLoadReport {
    const totalLoaded = fileResults.reduce((sum, entry) => sum + entry.loadedServerCount, 0);
    const totalFailed = fileResults.reduce((sum, entry) => sum + entry.failedServerCount, 0);
    const totalSkipped = fileResults.filter((entry) => entry.status === "skipped").length;

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalDiscovered,
      totalLoaded,
      totalSkipped,
      totalFailed,
      fileResults,
    };
  }
}
