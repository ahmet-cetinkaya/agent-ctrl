import { Command } from "commander";
import { createCommandListCommand } from "./command_ls";

export function createCommandCommand(): Command {
  return new Command("command").description("Manage commands").addCommand(createCommandListCommand());
}
