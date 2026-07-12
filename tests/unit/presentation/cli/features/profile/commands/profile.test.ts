import { describe, it, expect } from "bun:test";
import { groupByCategory } from "@/presentation/cli/features/profile/commands/profile";
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
