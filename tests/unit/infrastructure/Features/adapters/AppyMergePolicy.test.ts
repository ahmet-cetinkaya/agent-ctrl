import { describe, it, expect } from "bun:test";
import { AppyMergePolicy } from "@/infrastructure/features/apply/adapters/AppyMergePolicy";

describe("AppyMergePolicy", () => {
  it("supports class instantiation", () => {
    const policy = new AppyMergePolicy();
    expect(policy).toBeInstanceOf(AppyMergePolicy);
  });

  it("returns unchanged when normalized content matches", () => {
    const result = AppyMergePolicy.mergeText("hello\r\n", "hello\n", false);
    expect(result.status).toBe("unchanged");
    expect(result.content).toBe("hello\r\n");
  });

  it("returns success when content differs", () => {
    const result = AppyMergePolicy.mergeText("old", "new", false);
    expect(result.status).toBe("success");
    expect(result.content).toBe("new");
  });

  it("returns success when override is enabled", () => {
    const result = AppyMergePolicy.mergeText("same", "same", true);
    expect(result.status).toBe("success");
    expect(result.content).toBe("same");
  });
});
