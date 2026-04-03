import type { FixPlanEpicGroup } from "./types.js";

export interface PartitionResult {
  partitions: FixPlanEpicGroup[][];
  adjustedWorkerCount: number;
  warnings: string[];
}

/**
 * Partitions epic groups across N workers using greedy bin-packing.
 *
 * Algorithm:
 * 1. Filter to epics with incomplete stories
 * 2. Sort by descending incomplete story count
 * 3. Assign each epic to the worker with fewest incomplete stories
 */
export function partitionByEpic(groups: FixPlanEpicGroup[], workerCount: number): PartitionResult {
  const warnings: string[] = [];

  const incompleteGroups = groups.filter((g) => g.stories.some((s) => !s.completed));

  if (incompleteGroups.length === 0) {
    throw new Error("Swarm: nothing to implement — all stories are completed");
  }

  if (incompleteGroups.length === 1 && workerCount > 1) {
    throw new Error(
      "Swarm requires at least 2 incomplete epics to parallelize. " +
        `Only "${incompleteGroups[0]!.epicHeading}" has incomplete stories.`
    );
  }

  let adjustedCount = Math.min(workerCount, incompleteGroups.length);
  if (adjustedCount < workerCount) {
    warnings.push(
      `Worker count reduced from ${workerCount} to ${adjustedCount} (only ${adjustedCount} incomplete epics)`
    );
  }

  // Ensure at least 1 worker
  adjustedCount = Math.max(1, adjustedCount);

  // Sort epics by descending incomplete story count for greedy bin-packing
  const sorted = [...incompleteGroups].sort((a, b) => {
    const aIncomplete = a.stories.filter((s) => !s.completed).length;
    const bIncomplete = b.stories.filter((s) => !s.completed).length;
    return bIncomplete - aIncomplete;
  });

  // Initialize partitions with load counters
  const partitions: FixPlanEpicGroup[][] = Array.from({ length: adjustedCount }, () => []);
  const loads = new Array<number>(adjustedCount).fill(0);

  // Greedy assignment: assign next-largest epic to least-loaded worker
  for (const group of sorted) {
    const incompleteCount = group.stories.filter((s) => !s.completed).length;
    const minIdx = loads.indexOf(Math.min(...loads));
    partitions[minIdx]!.push(group);
    loads[minIdx]! += incompleteCount;
  }

  return { partitions, adjustedWorkerCount: adjustedCount, warnings };
}
