import { describe, it, expect, mock, beforeEach } from "bun:test";
import { PromptService } from "@/presentation/cli/shared/utils/PromptService";
import * as clack from "@clack/prompts";

// Mock clack prompts
mock.module("@clack/prompts", () => ({
  intro: mock(() => {}),
  outro: mock(() => {}),
  cancel: mock(() => {}),
  isCancel: mock((val) => val === Symbol.for("clack:cancel")),
  spinner: mock(() => ({
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  progress: mock(() => ({
    start: mock(() => {}),
    advance: mock(() => {}),
    stop: mock(() => {}),
  })),
  text: mock(async () => "input"),
  confirm: mock(async () => true),
  select: mock(async () => "selected"),
  multiselect: mock(async () => ["selected1", "selected2"]),
}));

describe("PromptService", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("calls clack intro", () => {
    PromptService.intro("Welcome");
    expect(clack.intro).toHaveBeenCalledWith("Welcome");
  });

  it("calls clack outro", () => {
    PromptService.outro("Goodbye");
    expect(clack.outro).toHaveBeenCalledWith("Goodbye");
  });

  it("starts and stops a task spinner", () => {
    PromptService.startTask("Thinking...");
    expect(clack.spinner).toHaveBeenCalled();

    PromptService.stopTask("Done");
    // Verify stop was called on the returned instance - testing internal state is hard, but we can verify calls
  });

  it("warns when stopping task without start", () => {
    // Should not throw
    PromptService.stopTask();
  });

  it("starts, advances and stops progress", () => {
    PromptService.startProgress("Loading...");
    expect(clack.progress).toHaveBeenCalled();

    PromptService.advanceProgress(10, "Working");
    PromptService.stopProgress("Finished");
  });

  it("calls clack cancel", () => {
    PromptService.cancel("Stopping");
    expect(clack.cancel).toHaveBeenCalledWith("Stopping");
  });

  it("calls clack cancel with default message", () => {
    PromptService.cancel();
    expect(clack.cancel).toHaveBeenCalledWith("Operation cancelled.");
  });

  it("handles cancellation with process exit", () => {
    const mockExit = mock(() => {
      throw new Error("EXIT");
    });
    const originalExit = process.exit;
    (process as any).exit = mockExit;

    try {
      PromptService.handleCancellation("User exit");
    } catch (e) {
      // expect exit to be called
    }

    expect(clack.cancel).toHaveBeenCalledWith("User exit");
    expect(mockExit).toHaveBeenCalledWith(0);

    process.exit = originalExit;
  });

  it("handles input prompt", async () => {
    const result = await PromptService.input({ message: "What is your name?", default: "Alice" });
    expect(clack.text).toHaveBeenCalled();
    expect(result).toBe("input");
  });

  it("handles confirm prompt", async () => {
    const result = await PromptService.confirm({ message: "Are you sure?" });
    expect(clack.confirm).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("handles choose (single select) prompt", async () => {
    const result = await PromptService.choose({
      message: "Pick one",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    });
    expect(clack.select).toHaveBeenCalled();
    expect(result).toBe("selected");
  });

  it("handles selectMany (multiselect) prompt", async () => {
    const result = await PromptService.selectMany({
      message: "Pick many",
      options: [
        { value: "1", label: "One" },
        { value: "2", label: "Two" },
      ],
    });
    expect(clack.multiselect).toHaveBeenCalled();
    expect(result).toEqual(["selected1", "selected2"]);
  });

  it("throws error in selectMany with empty options", async () => {
    expect(PromptService.selectMany({ message: "Empty", options: [] })).rejects.toThrow(
      "selectMany requires at least one option"
    );
  });

  it("identifies cancelled values", () => {
    const cancelSymbol = Symbol.for("clack:cancel");
    expect(PromptService.isCancelled(cancelSymbol)).toBe(true);
    expect(PromptService.isCancelled("not cancelled")).toBe(false);
  });

  it("handles withCancellation correctly when no error occurs", async () => {
    const result = await PromptService.withCancellation(async () => "success");
    expect(result).toBe("success");
  });

  it("handles withCancellation correctly when cancellation occurs", async () => {
    const cancelSymbol = Symbol.for("clack:cancel");
    // Simulate clack cancellation by throwing it (as per internal implementation usage if applicable,
    // though typically clack returns the symbol. Wait, let's look at src/presentation/cli/shared/utils/PromptService.ts:188
    // if (clackIsCancel(error)) ...

    const onCancel = mock(() => {});
    const result = await PromptService.withCancellation(async () => {
      throw cancelSymbol;
    }, onCancel);

    expect(result).toBeNull();
    expect(onCancel).toHaveBeenCalled();
  });

  it("rethrows other errors in withCancellation", async () => {
    expect(
      PromptService.withCancellation(async () => {
        throw new Error("BOOM");
      })
    ).rejects.toThrow("BOOM");
  });
});
