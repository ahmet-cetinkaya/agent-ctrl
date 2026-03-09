import { Command } from "commander";
import { createMcpListCommand } from "./mcp_ls";
import { createMcpSearchCommand } from "./mcp_search";
import { createMcpSyncCommand } from "./mcp_sync";
import { createMcpAddCommand } from "./mcp_add";
import { createMcpRemoveCommand } from "./mcp_rm";
import { createMcpUpdateCommand } from "./mcp_update";

export function createMcpCommand(): Command {
  return new Command("mcp")
    .description("Manage MCP server configurations")
    .addCommand(createMcpListCommand())
    .addCommand(createMcpSearchCommand())
    .addCommand(createMcpSyncCommand())
    .addCommand(createMcpAddCommand())
    .addCommand(createMcpRemoveCommand())
    .addCommand(createMcpUpdateCommand());
}
