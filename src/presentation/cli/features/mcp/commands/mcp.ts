import { Command } from "commander";
import { createMcpListCommand } from "./mcp_ls";

export function createMcpCommand(): Command {
  return new Command("mcp").description("Manage MCP server configurations").addCommand(createMcpListCommand());
}
