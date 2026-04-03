import { describe, it, expect } from "vitest";
import { partitionByEpic } from "../../src/swarm/partitioner.js";
import type { FixPlanEpicGroup } from "../../src/swarm/types.js";

function makeGroup(heading: string, storyCount: number, completedCount = 0): FixPlanEpicGroup {
  const stories = Array.from({ length: storyCount }, (_, i) => ({
    id: `${heading.length}.${i + 1}`,
    completed: i < completedCount,
    title: `Story ${i + 1}`,
  }));
  return {
    rawBlock:
      `### ${heading}\n` +
      stories.map((s) => `- [${s.completed ? "x" : " "}] Story ${s.id}: ${s.title}`).join("\n"),
    epicHeading: `### ${heading}`,
    epicGoal: null,
    stories,
  };
}

describe("partitionByEpic", () => {
  it("distributes epics across workers using greedy bin-packing", () => {
    const groups = [makeGroup("Auth", 4), makeGroup("Search", 3), makeGroup("Notifications", 2)];

    const result = partitionByEpic(groups, 2);

    expect(result.partitions).toHaveLength(2);
    // Greedy bin-packing: Auth (4) assigned first to empty worker, then Search (3) + Notifications (2) to the other
    const loads = result.partitions
      .map((p) => p.reduce((sum, g) => sum + g.stories.filter((s) => !s.completed).length, 0))
      .sort((a, b) => a - b);
    // Expect [4, 5] distribution (sorted)
    expect(loads).toEqual([4, 5]);
  });

  it("reduces worker count when fewer epics than workers", () => {
    const groups = [makeGroup("Auth", 3), makeGroup("Search", 2)];

    const result = partitionByEpic(groups, 5);

    expect(result.partitions).toHaveLength(2);
    expect(result.adjustedWorkerCount).toBe(2);
    expect(result.warnings).toContainEqual(expect.stringContaining("reduced"));
  });

  it("skips fully completed epics", () => {
    const groups = [
      makeGroup("Auth", 3, 3), // all completed
      makeGroup("Search", 2),
      makeGroup("Notifications", 2),
    ];

    const result = partitionByEpic(groups, 2);

    // Only Search and Notifications should be distributed
    const allGroups = result.partitions.flat();
    const headings = allGroups.map((g) => g.epicHeading);
    expect(headings).not.toContain("### Auth");
    expect(headings).toContain("### Search");
    expect(headings).toContain("### Notifications");
  });

  it("throws when zero incomplete stories", () => {
    const groups = [makeGroup("Auth", 2, 2)];

    expect(() => partitionByEpic(groups, 2)).toThrow("nothing to implement");
  });

  it("throws when single incomplete epic with N > 1", () => {
    const groups = [makeGroup("Auth", 3)];

    expect(() => partitionByEpic(groups, 2)).toThrow("requires at least 2");
  });

  it("handles single worker (assigns all epics)", () => {
    const groups = [makeGroup("Auth", 3), makeGroup("Search", 2)];

    const result = partitionByEpic(groups, 1);

    expect(result.partitions).toHaveLength(1);
    expect(result.partitions[0]).toHaveLength(2);
  });

  it("balances roughly evenly", () => {
    const groups = [makeGroup("A", 5), makeGroup("B", 4), makeGroup("C", 3), makeGroup("D", 2)];

    const result = partitionByEpic(groups, 2);

    const counts = result.partitions.map((p) =>
      p.reduce((sum, g) => sum + g.stories.filter((s) => !s.completed).length, 0)
    );
    // Should be roughly balanced (diff <= 2)
    expect(Math.abs(counts[0]! - counts[1]!)).toBeLessThanOrEqual(2);
  });

  it("handles mixed completed and incomplete stories within an epic", () => {
    const groups = [
      makeGroup("Auth", 4, 2), // 2 done, 2 remaining
      makeGroup("Search", 3),
    ];

    const result = partitionByEpic(groups, 2);

    // Auth has 2 incomplete, Search has 3 — both should be assigned
    expect(result.partitions).toHaveLength(2);
  });

  it("returns empty warnings when everything is normal", () => {
    const groups = [makeGroup("Auth", 3), makeGroup("Search", 2)];

    const result = partitionByEpic(groups, 2);

    expect(result.warnings).toHaveLength(0);
  });
});
