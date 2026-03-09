import { Command } from "commander";
import { createSkillListCommand } from "./skill_ls";
import { createSkillSearchCommand } from "./skill_search";
import { createSkillSyncCommand } from "./skill_sync";
import { createSkillAddCommand } from "./skill_add";
import { createSkillRemoveCommand } from "./skill_rm";
import { createSkillUpdateCommand } from "./skill_update";

export function createSkillCommand(): Command {
  return new Command("skill")
    .description("Manage skills")
    .addCommand(createSkillListCommand())
    .addCommand(createSkillSearchCommand())
    .addCommand(createSkillSyncCommand())
    .addCommand(createSkillAddCommand())
    .addCommand(createSkillRemoveCommand())
    .addCommand(createSkillUpdateCommand());
}
