import { describe, it, expect } from "bun:test";
import { ApplyMergePolicy } from "@/infrastructure/features/apply/adapters/ApplyMergePolicy";

describe("ApplyMergePolicy", () => {
  it("supports class instantiation", () => {
    const policy = new ApplyMergePolicy();
    expect(policy).toBeInstanceOf(ApplyMergePolicy);
  });

  it("returns unchanged when normalized content matches", () => {
    const result = ApplyMergePolicy.mergeText("hello\r\n", "hello\n", false);
    expect(result.status).toBe("unchanged");
    expect(result.content).toBe("hello\r\n");
  });

  it("returns success when content differs", () => {
    const result = ApplyMergePolicy.mergeText("old", "new", false);
    expect(result.status).toBe("success");
    expect(result.content).toBe("new");
  });

  it("returns success when override is enabled", () => {
    const result = ApplyMergePolicy.mergeText("same", "same", true);
    expect(result.status).toBe("success");
    expect(result.content).toBe("same");
  });
});
