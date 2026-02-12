import { Command } from "commander";
import { createRuleListCommand } from "./rule_ls";

export function createRuleCommand(): Command {
  return new Command("rule").description("Manage rules").addCommand(createRuleListCommand());
}
