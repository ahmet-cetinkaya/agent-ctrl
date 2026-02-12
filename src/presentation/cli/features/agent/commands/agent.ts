import { Command } from "commander";
import { createAgentListCommand } from "./agent_ls";

export function createAgentCommand(): Command {
  return new Command("agent").description("Manage agents").addCommand(createAgentListCommand());
}
