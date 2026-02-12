import type { Agent } from "@/core/domain/shared/entities/Agent";

export interface ScannedFile {
  name: string;
  path: string;
  isDirectory: boolean;
  extension: string;
}

export interface AgentScanResult {
  files: ScannedFile[];
  artifacts: Agent[];
  warnings: string[];
}

export interface IAgentScanner {
  scan(agentsPath: string): Promise<AgentScanResult>;
}
