import {
  intro as clackIntro,
  outro as clackOutro,
  isCancel as clackIsCancel,
  cancel as clackCancel,
  text,
  confirm,
  select,
  multiselect,
  groupMultiselect,
  spinner,
  progress,
} from "@clack/prompts";
import { LogService } from "./LogService";

export interface PromptOption<T> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export interface PromptOptions<T> {
  message: string;
  initial?: T;
  options: PromptOption<T>[];
}

type SpinnerInstance = ReturnType<typeof spinner>;
type ProgressInstance = ReturnType<typeof progress>;

export class PromptService {
  private static activeSpinner: SpinnerInstance | null = null;
  private static activeProgress: ProgressInstance | null = null;

  /**
   * Displays an introduction message.
   */
  static intro(message: string): void {
    clackIntro(message);
  }

  /**
   * Displays a completion message.
   */
  static outro(message: string): void {
    clackOutro(message);
  }

  /**
   * Cancels the current operation with an optional message.
   */
  static cancel(message?: string): void {
    this.stopTask();
    this.stopProgress();
    clackCancel(message ?? "Operation cancelled.");
  }

  /**
   * Checks if a value is a clack cancellation symbol.
   */
  static isCancelled<T>(value: T): boolean {
    return clackIsCancel(value);
  }

  /**
   * Starts a spinner task.
   */
  static startTask(message: string): void {
    this.activeSpinner = spinner();
    this.activeSpinner.start(message);
  }

  /**
   * Stops the active spinner task.
   */
  static stopTask(message?: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.stop(message ?? "Done");
      this.activeSpinner = null;
    } else {
      LogService.warn("PromptService.stopTask called without active spinner");
    }
  }

  /**
   * Starts a progress bar.
   */
  static startProgress(message: string): void {
    this.activeProgress = progress();
    this.activeProgress.start(message);
  }

  /**
   * Advances the progress bar.
   */
  static advanceProgress(by: number, message?: string): void {
    if (this.activeProgress) {
      this.activeProgress.advance(by, message);
    }
  }

  /**
   * Stops the progress bar.
   */
  static stopProgress(message?: string): void {
    if (this.activeProgress) {
      this.activeProgress.stop(message ?? "Complete");
      this.activeProgress = null;
    }
  }

  /**
   * Prompts for text input.
   */
  static async input(options: { message: string; default?: string }): Promise<string | symbol | null> {
    const result = await text({
      message: options.message,
      defaultValue: options.default,
    });
    return result as string | symbol | null;
  }

  /**
   * Confirmation prompt.
   */
  static async confirm(options: { message: string; initial?: boolean }): Promise<boolean | symbol | null> {
    const result = await confirm({
      message: options.message,
      initialValue: options.initial,
    });
    return result as boolean | symbol | null;
  }

  /**
   * Selection prompt for a single option.
   */
  static async choose<T>(options: PromptOptions<T>): Promise<T | symbol | null> {
    const result = await select({
      message: options.message,
      options: options.options.map((o) => ({ value: o.value as any, label: o.label, hint: o.hint })),
      initialValue: options.initial as any,
    });
    return result as T | symbol | null;
  }

  /**
   * Selection prompt for multiple options.
   *
   * @template T - Type of the value associated with each option.
   * @param {Object} options - Configuration for the selection prompt.
   * @param {string} options.message - The question to display.
   * @param {PromptOption<T>[]} options.options - The list of available choices.
   * @param {boolean} [options.required] - If true, ensures at least one option is selected.
   * @returns {Promise<T[] | symbol | null>} Returns an array of selected values, or a cancellation symbol/null.
   * @throws {Error} If no options are provided.
   */
  static async selectMany<T>(options: {
    message: string;
    options: PromptOption<T>[];
    required?: boolean;
  }): Promise<T[] | symbol | null> {
    if (options.options.length === 0) {
      throw new Error("selectMany requires at least one option");
    }
    const result = await multiselect({
      message: options.message,
      options: options.options.map((o) => ({ value: o.value as any, label: o.label, hint: o.hint })),
      required: options.required,
    });
    return result as T[] | symbol | null;
  }

  /**
   * Selection prompt for multiple options grouped by category.
   *
   * @template T - Type of the value associated with each option.
   * @param {string} options.message - The question to display.
   * @param {Record<string, PromptOption<T>[]>} options.groups - Options keyed by group label.
   * @param {boolean} [options.required] - If true, ensures at least one option is selected.
   * @param {boolean} [options.selectableGroups] - If false, group headings can't be used to bulk-select/deselect their items; only individual options are selectable. Defaults to true (clack's default).
   * @returns {Promise<T[] | symbol | null>} Selected values, or a cancellation symbol/null.
   * @throws {Error} If no options are provided across all groups.
   */
  static async selectManyGrouped<T>(options: {
    message: string;
    groups: Record<string, PromptOption<T>[]>;
    required?: boolean;
    selectableGroups?: boolean;
  }): Promise<T[] | symbol | null> {
    const totalOptions = Object.values(options.groups).reduce((sum, opts) => sum + opts.length, 0);
    if (totalOptions === 0) {
      throw new Error("selectManyGrouped requires at least one option");
    }

    const mappedGroups: Record<string, { value: any; label: string; hint?: string }[]> = {};
    for (const [group, opts] of Object.entries(options.groups)) {
      mappedGroups[group] = opts.map((o) => ({ value: o.value as any, label: o.label, hint: o.hint }));
    }

    const result = await groupMultiselect({
      message: options.message,
      options: mappedGroups,
      required: options.required,
      selectableGroups: options.selectableGroups,
    });
    return result as T[] | symbol | null;
  }

  /**
   * Handles user cancellation by exiting the process.
   */
  static handleCancellation(message?: string): void {
    this.cancel(message);
    process.exit(0);
  }

  /**
   * Wraps an async handler with cancellation support.
   */
  static async withCancellation<T>(handler: () => Promise<T>, onCancel?: () => void): Promise<T | null> {
    try {
      return await handler();
    } catch (error) {
      if (clackIsCancel(error)) {
        if (onCancel) onCancel();
        else this.handleCancellation();

        return null;
      }
      throw error;
    }
  }
}
