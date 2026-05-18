import { outro as clackOutro, log as clackLog, note as clackNote } from "@clack/prompts";
import color from "picocolors";

export class LogService {
  static intro(message: string): void {
    clackLog.message(color.cyan(message));
  }

  static outro(message: string): void {
    clackOutro(message);
  }

  static log(message: string): void {
    clackLog.message(message);
  }

  static unstyled(message: string): void {
    process.stdout.write(message + "\n");
  }

  static step(message: string): void {
    clackLog.step(message);
  }

  static success(message: string): void {
    clackLog.success(message);
  }

  static warn(message: string): void {
    clackLog.warn(message);
  }

  static error(message: string): void {
    clackLog.error(message);
  }

  static info(message: string): void {
    clackLog.info(message);
  }

  static note(message: string, title?: string): void {
    const lines = message.split("\n");
    const resetMessage = lines.map((line) => color.reset(line)).join("\n");
    clackNote(resetMessage, title);
  }

  static section(message: string): void {
    clackLog.info(`\n${message}`);
  }

  static items(label: string, values: string[]): void {
    clackLog.info(label);
    for (const v of values) {
      clackLog.info(`  ${v}`);
    }
  }

  static help(
    description: string,
    usage: string,
    commands: { name: string; description: string }[],
    options: { flag: string; description: string }[]
  ): void {
    const sections: string[] = [];

    sections.push(color.bold(description));
    sections.push("");
    sections.push(color.bold("Usage:"));
    sections.push(`  ${usage}`);

    if (commands.length > 0) {
      sections.push("");
      sections.push(color.bold("Commands:"));
      const maxNameLen = Math.max(...commands.map((c) => c.name.length));
      for (const cmd of commands) {
        const padded = cmd.name.padEnd(maxNameLen + 2);
        sections.push(`  ${color.cyan(padded)}${cmd.description}`);
      }
    }

    if (options.length > 0) {
      sections.push("");
      sections.push(color.bold("Options:"));
      const maxFlagLen = Math.max(...options.map((o) => o.flag.length));
      for (const opt of options) {
        const padded = opt.flag.padEnd(maxFlagLen + 2);
        sections.push(`  ${color.yellow(padded)}${opt.description}`);
      }
    }

    this.note(sections.join("\n"));
  }
}
