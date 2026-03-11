import { describe, it, expect, afterEach } from "bun:test";
import { McpConfigRendererFactory } from "@/infrastructure/features/apply/adapters/McpConfigRendererFactory";
import { OpenCodeMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/OpenCodeMcpConfigRenderer";
import type { IMcpConfigRenderer } from "@/infrastructure/features/apply/adapters/IMcpConfigRenderer";

describe("McpConfigRendererFactory", () => {
  afterEach(() => {
    McpConfigRendererFactory.reset();
  });

  it("should get registered renderer for opencode platform", () => {
    const renderer = McpConfigRendererFactory.getRenderer("opencode");
    expect(renderer).toBeInstanceOf(OpenCodeMcpConfigRenderer);
  });

  it("should get registered renderer for settings platform", () => {
    const renderer = McpConfigRendererFactory.getRenderer("settings");
    expect(renderer).toBeDefined();
    expect(renderer.renderConfig).toBeDefined();
  });

  it("should get registered renderer for codex platform", () => {
    const renderer = McpConfigRendererFactory.getRenderer("codex");
    expect(renderer).toBeDefined();
    expect(renderer.renderConfig).toBeDefined();
  });

  it("should throw error for unregistered platform", () => {
    expect(() => McpConfigRendererFactory.getRenderer("unknown")).toThrow(
      "No MCP config renderer registered for platform: unknown"
    );
  });

  it("should allow registering custom renderer", () => {
    const customRenderer: IMcpConfigRenderer = {
      renderConfig: () => ({ custom: "mcp config" }),
    };

    McpConfigRendererFactory.registerRenderer("custom", customRenderer);
    const renderer = McpConfigRendererFactory.getRenderer("custom");
    expect(renderer.renderConfig({}, [])).toEqual({ custom: "mcp config" });
  });

  it("should return the same renderer instance for same platform", () => {
    const renderer1 = McpConfigRendererFactory.getRenderer("opencode");
    const renderer2 = McpConfigRendererFactory.getRenderer("opencode");
    expect(renderer1).toBe(renderer2);
  });

  it("should allow replacing existing renderer", () => {
    const newRenderer: IMcpConfigRenderer = {
      renderConfig: () => ({ replaced: true }),
    };

    McpConfigRendererFactory.registerRenderer("opencode", newRenderer);
    const renderer = McpConfigRendererFactory.getRenderer("opencode");
    expect(renderer.renderConfig({}, [])).toEqual({ replaced: true });
  });

  it("should allow registering multiple custom renderers", () => {
    const renderer1: IMcpConfigRenderer = { renderConfig: () => ({ p1: true }) };
    const renderer2: IMcpConfigRenderer = { renderConfig: () => ({ p2: true }) };

    McpConfigRendererFactory.registerRenderer("platform1", renderer1);
    McpConfigRendererFactory.registerRenderer("platform2", renderer2);

    expect(McpConfigRendererFactory.getRenderer("platform1").renderConfig({}, [])).toEqual({ p1: true });
    expect(McpConfigRendererFactory.getRenderer("platform2").renderConfig({}, [])).toEqual({ p2: true });
  });
});
