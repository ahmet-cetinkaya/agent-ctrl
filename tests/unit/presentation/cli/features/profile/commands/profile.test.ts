import { describe, it, expect } from "bun:test";
import {
  groupByCategory,
  groupSingletonCategories,
  titleCaseCategory,
  STANDALONE_CATEGORY,
} from "@/presentation/cli/features/profile/commands/profile";
import type { ProfileListItem } from "@/core/application/features/apply/commands/ProfileListCommand";

function makeItem(overrides: Partial<ProfileListItem> & Pick<ProfileListItem, "name" | "category">): ProfileListItem {
  return {
    displayName: overrides.displayName ?? overrides.name,
    description: overrides.description ?? "",
    tags: overrides.tags ?? [],
    ...overrides,
  };
}

describe("profile.ts groupByCategory", () => {
  it("groups items by category", () => {
    const details = [
      makeItem({ name: "a", category: "ai" }),
      makeItem({ name: "b", category: "web" }),
      makeItem({ name: "c", category: "ai" }),
    ];

    const grouped = groupByCategory(details);
    const categories = grouped.map(([category]) => category);

    expect(categories).toEqual(["ai", "web"]);
    expect(grouped.find(([c]) => c === "ai")?.[1].map((i) => i.name)).toEqual(["a", "c"]);
  });

  it("sorts named categories alphabetically", () => {
    const details = [
      makeItem({ name: "a", category: "zebra" }),
      makeItem({ name: "b", category: "alpha" }),
      makeItem({ name: "c", category: "middle" }),
    ];

    const categories = groupByCategory(details).map(([category]) => category);

    expect(categories).toEqual(["alpha", "middle", "zebra"]);
  });

  it("always sorts Uncategorized last, regardless of input order", () => {
    const details = [
      makeItem({ name: "a", category: "Uncategorized" }),
      makeItem({ name: "b", category: "zebra" }),
      makeItem({ name: "c", category: "alpha" }),
    ];

    const categories = groupByCategory(details).map(([category]) => category);

    expect(categories).toEqual(["alpha", "zebra", "Uncategorized"]);
  });

  it("returns no groups for an empty input", () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe("profile.ts groupSingletonCategories", () => {
  it("merges categories with a single profile into a trailing Standalone group", () => {
    const grouped = groupByCategory([
      makeItem({ name: "a", category: "ai" }),
      makeItem({ name: "b", category: "web" }),
      makeItem({ name: "c", category: "ai" }),
    ]);

    const result = groupSingletonCategories(grouped);
    const categories = result.map(([category]) => category);

    expect(categories).toEqual(["ai", STANDALONE_CATEGORY]);
    expect(result.find(([c]) => c === STANDALONE_CATEGORY)?.[1].map((i) => i.name)).toEqual(["b"]);
  });

  it("keeps multi-item categories grouped and adds no Standalone group when none qualify", () => {
    const grouped = groupByCategory([
      makeItem({ name: "a", category: "ai" }),
      makeItem({ name: "b", category: "ai" }),
      makeItem({ name: "c", category: "web" }),
      makeItem({ name: "d", category: "web" }),
    ]);

    const categories = groupSingletonCategories(grouped).map(([category]) => category);

    expect(categories).toEqual(["ai", "web"]);
  });

  it("moves every profile into Standalone when each category has exactly one profile", () => {
    const grouped = groupByCategory([
      makeItem({ name: "a", category: "ai" }),
      makeItem({ name: "b", category: "web" }),
      makeItem({ name: "c", category: "Uncategorized" }),
    ]);

    const result = groupSingletonCategories(grouped);

    expect(result.map(([category]) => category)).toEqual([STANDALONE_CATEGORY]);
    expect(result[0][1].map((item) => item.name)).toEqual(["a", "b", "c"]);
  });
});

describe("profile.ts titleCaseCategory", () => {
  it("capitalizes a single lowercase word", () => {
    expect(titleCaseCategory("web")).toBe("Web");
  });

  it("title-cases each hyphen-separated word", () => {
    expect(titleCaseCategory("oss-release")).toBe("Oss Release");
  });

  it("title-cases each underscore-separated word", () => {
    expect(titleCaseCategory("machine_learning")).toBe("Machine Learning");
  });

  it("normalizes already-mixed casing", () => {
    expect(titleCaseCategory("ALREADY-UPPER")).toBe("Already Upper");
  });

  it("leaves an already-title-cased category unchanged", () => {
    expect(titleCaseCategory(STANDALONE_CATEGORY)).toBe(STANDALONE_CATEGORY);
  });

  it("returns an empty string for empty input", () => {
    expect(titleCaseCategory("")).toBe("");
  });
});
