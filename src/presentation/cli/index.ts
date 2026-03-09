#!/usr/bin/env node

import { Command } from "commander";
import { createInitCommand } from "@/presentation/cli/features/init/commands/init";
import { createRuleCommand } from "@/presentation/cli/features/rule/commands/rule";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { createAgentCommand } from "@/presentation/cli/features/agent/commands/agent";
import { createCommandCommand } from "@/presentation/cli/features/command/commands/command";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { createApplyCommand } from "@/presentation/cli/features/apply/commands/apply";
import { ErrorHandler } from "@/presentation/cli/shared/middleware/errorHandler";

const VERSION = "0.1.0";

const program = new Command();
const errorHandler = new ErrorHandler();

program
  .name("agent-ctrl")
  .description("A centralized CLI tool for managing AI agent configurations")
  .version(VERSION)
  .option("-v, --verbose", "Enable verbose output", false)
  .option("-q, --quiet", "Suppress warnings", false);

program.addCommand(createInitCommand());
program.addCommand(createRuleCommand());
program.addCommand(createSkillCommand());
program.addCommand(createAgentCommand());
program.addCommand(createCommandCommand());
program.addCommand(createMcpCommand());
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

await program.parseAsync(process.argv);
