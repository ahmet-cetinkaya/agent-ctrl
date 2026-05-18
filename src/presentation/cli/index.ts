#!/usr/bin/env node

import { Command } from "commander";
import { intro, outro } from "@clack/prompts";
import color from "picocolors";
import { createInitCommand } from "@/presentation/cli/features/init/commands/init";
import { createRuleCommand } from "@/presentation/cli/features/rule/commands/rule";
import { createSkillCommand } from "@/presentation/cli/features/skill/commands/skill";
import { createAgentCommand } from "@/presentation/cli/features/agent/commands/agent";
import { createCommandCommand } from "@/presentation/cli/features/command/commands/command";
import { createMcpCommand } from "@/presentation/cli/features/mcp/commands/mcp";
import { createApplyCommand } from "@/presentation/cli/features/apply/commands/apply";
import { ErrorHandler } from "@/presentation/cli/shared/middleware/errorHandler";
import { LogService } from "@/presentation/cli/shared/utils/LogService";

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

program.configureHelp({
  showGlobalOptions: true,
  formatHelp: (cmd, helper) => {
    const commands = cmd.commands.map((c) => ({
      name: c.name(),
      description: c.description() || "",
    }));

    const options = [
      { flag: "-V, --version", description: "Output the version number" },
      { flag: "-v, --verbose", description: "Enable verbose output" },
      { flag: "-q, --quiet", description: "Suppress warnings" },
      { flag: "-h, --help", description: "Display help for command" },
    ];

    LogService.help(
      cmd.description() || "A centralized CLI tool for managing AI agent configurations",
      cmd.usage() || "agent-ctrl [options] [command]",
      commands,
      options
    );

    outro(color.cyan("Run agent-ctrl <command> --help for more information"));

    return "";
  },
});

// Global error handling
process.on("uncaughtException", (error) => {
  errorHandler.handle(error);
});

process.on("unhandledRejection", (reason) => {
  errorHandler.handle(reason);
});

// SIGINT handling (T075)
process.on("SIGINT", () => {
  outro(color.yellow("Operation cancelled by user"));
  process.exit(0);
});

intro(color.inverse(" agent-ctrl "));

await program.parseAsync(process.argv);

outro(color.cyan("Execution completed"));
