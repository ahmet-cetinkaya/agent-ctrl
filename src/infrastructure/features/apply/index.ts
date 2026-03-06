import { McpServerAggregator } from "@/infrastructure/features/mcp/loaders/McpServerAggregator";

export function createMcpConfigLoader(): McpServerAggregator {
  return new McpServerAggregator();
}
