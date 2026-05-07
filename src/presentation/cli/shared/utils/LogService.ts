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

  static raw(message: string): void {
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
}
