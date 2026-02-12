#!/usr/bin/env node

import { Command } from "commander";
import { createInitCommand } from "./features/init/commands/init";
import { createRuleCommand } from "./features/rule/commands/rule";
import { createSkillCommand } from "./features/skill/commands/skill";
import { createAgentCommand } from "./features/agent/commands/agent";
import { createApplyCommand } from "./features/apply/commands/apply";
import { ErrorHandler } from "./shared/middleware/errorHandler";
import { createAgentListCommand } from "./features/agent/commands/agent_ls";

const VERSION = "0.1.0";

const program = new Command();
const errorHandler = new ErrorHandler();

program
  .name("agent-ctrl")
  .description("A centralized CLI tool for managing AI agent configurations")
  .version(VERSION)
  .option("-v, --verbose", "Enable verbose output", false)
  .option("-q, --quiet", "Suppress warnings", false);

// TODO: Register commands here (T030, T050, T069)
program.addCommand(createInitCommand());
program.addCommand(createRuleCommand());
program.addCommand(createSkillCommand());
program.addCommand(createAgentCommand());
program.addCommand(createApplyCommand());

// Global error handling
process.on("uncaughtException", (error) => {
  errorHandler.handle(error);
});

process.on("unhandledRejection", (reason) => {
  errorHandler.handle(reason);
});

// SIGINT handling (T075)
process.on("SIGINT", () => {
  console.log("\n\nOperation cancelled by user");
  process.exit(0);
});

program.parse();
