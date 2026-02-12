import { Command } from "commander";
import { createSkillListCommand } from "./skill_ls";

export function createSkillCommand(): Command {
  return new Command("skill")
    .description("Manage skills")
    .addCommand(createSkillListCommand());
}
