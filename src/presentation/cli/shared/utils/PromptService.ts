import {
  intro as clackIntro,
  outro as clackOutro,
  isCancel as clackIsCancel,
  cancel as clackCancel,
  text,
  confirm,
  select,
  multiselect,
  spinner,
  progress,
} from "@clack/prompts";

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

  static intro(message: string): void {
    clackIntro(message);
  }

  static outro(message: string): void {
    clackOutro(message);
  }

  static cancel(message?: string): void {
    clackCancel(message ?? "Operation cancelled.");
  }

  static isCancelled<T>(value: T): boolean {
    return clackIsCancel(value);
  }

  static startTask(message: string): void {
    this.activeSpinner = spinner();
    this.activeSpinner.start(message);
  }

  static stopTask(message?: string): void {
    if (this.activeSpinner) {
      this.activeSpinner.stop(message ?? "Done");
      this.activeSpinner = null;
    }
  }

  static startProgress(message: string): void {
    this.activeProgress = progress();
    this.activeProgress.start(message);
  }

  static advanceProgress(by: number, message?: string): void {
    if (this.activeProgress) {
      this.activeProgress.advance(by, message);
    }
  }

  static stopProgress(message?: string): void {
    if (this.activeProgress) {
      this.activeProgress.stop(message ?? "Complete");
      this.activeProgress = null;
    }
  }

  static async input(options: { message: string; default?: string }): Promise<string | symbol | null> {
    const result = await text({
      message: options.message,
      defaultValue: options.default,
    });
    return result as string | symbol | null;
  }

  static async confirm(options: { message: string; initial?: boolean }): Promise<boolean | symbol | null> {
    const result = await confirm({
      message: options.message,
      initialValue: options.initial,
    });
    return result as boolean | symbol | null;
  }

  static async choose<T>(options: PromptOptions<T>): Promise<T | symbol | null> {
    const result = await select({
      message: options.message,
      options: options.options as never[],
      initialValue: options.initial as never,
    });
    return result as T | symbol | null;
  }

  static async selectMany<T>(options: {
    message: string;
    options: PromptOption<T>[];
    required?: boolean;
  }): Promise<T[] | symbol | null> {
    const result = await multiselect({
      message: options.message,
      options: options.options as never[],
      required: options.required,
    });
    return result as T[] | symbol | null;
  }

  static handleCancellation(): void {
    this.cancel();
    process.exit(0);
  }

  static async withCancellation<T>(handler: () => Promise<T>, onCancel?: () => void): Promise<T | null> {
    try {
      return await handler();
    } catch {
      if (onCancel) {
        onCancel();
      } else {
        this.handleCancellation();
      }
      return null;
    }
  }
}
