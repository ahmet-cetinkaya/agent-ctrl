import { describe, it, expect, afterEach } from "bun:test";
import { CommandRendererFactory } from "@/infrastructure/features/apply/adapters/CommandRendererFactory";
import { OpenCodeCommandRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeCommandRenderer";
import type { ICommandRenderer } from "@/infrastructure/features/apply/adapters/ICommandRenderer";

describe("CommandRendererFactory", () => {
  afterEach(() => {
    CommandRendererFactory.reset();
  });

  it("should get registered renderer for opencode platform", () => {
    const renderer = CommandRendererFactory.getRenderer("opencode");
    expect(renderer).toBeInstanceOf(OpenCodeCommandRenderer);
  });

  it("should get registered renderer for gemini platform", () => {
    const renderer = CommandRendererFactory.getRenderer("gemini");
    expect(renderer).toBeDefined();
    expect(renderer.renderCommand).toBeDefined();
  });

  it("should get registered renderer for workflow platform", () => {
    const renderer = CommandRendererFactory.getRenderer("workflow");
    expect(renderer).toBeDefined();
    expect(renderer.renderCommand).toBeDefined();
  });

  it("should throw error for unregistered platform", () => {
    expect(() => CommandRendererFactory.getRenderer("unknown")).toThrow(
      "No command renderer registered for platform: unknown"
    );
  });

  it("should allow registering custom renderer", () => {
    const customRenderer: ICommandRenderer = {
      fileExtension: ".txt",
      renderCommand: () => "custom command",
    };

    CommandRendererFactory.registerRenderer("custom", customRenderer);
    const renderer = CommandRendererFactory.getRenderer("custom");
    expect(renderer.renderCommand("", "")).toEqual("custom command");
  });

  it("should return the same renderer instance for same platform", () => {
    const renderer1 = CommandRendererFactory.getRenderer("opencode");
    const renderer2 = CommandRendererFactory.getRenderer("opencode");
    expect(renderer1).toBe(renderer2);
  });

  it("should allow replacing existing renderer", () => {
    const newRenderer: ICommandRenderer = {
      fileExtension: ".new",
      renderCommand: () => "replaced",
    };

    CommandRendererFactory.registerRenderer("opencode", newRenderer);
    const renderer = CommandRendererFactory.getRenderer("opencode");
    expect(renderer.renderCommand("", "")).toBe("replaced");
  });

  it("should allow registering multiple custom renderers", () => {
    const renderer1: ICommandRenderer = { fileExtension: ".r1", renderCommand: () => "r1" };
    const renderer2: ICommandRenderer = { fileExtension: ".r2", renderCommand: () => "r2" };

    CommandRendererFactory.registerRenderer("platform1", renderer1);
    CommandRendererFactory.registerRenderer("platform2", renderer2);

    expect(CommandRendererFactory.getRenderer("platform1").renderCommand("", "")).toBe("r1");
    expect(CommandRendererFactory.getRenderer("platform2").renderCommand("", "")).toBe("r2");
  });
});
