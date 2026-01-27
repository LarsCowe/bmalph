// Barrel file: re-exports from src/transition/ modules
// This maintains backward compatibility with existing imports

export type {
  ProjectContext,
  Story,
  TechStack,
  FixPlanItem,
  SpecsChange,
} from "./transition/types.js";

export {
  parseStories,
  parseStoriesWithWarnings,
  type ParseStoriesResult,
} from "./transition/story-parsing.js";

export {
  generateFixPlan,
  hasFixPlanProgress,
  parseFixPlan,
  mergeFixPlanProgress,
} from "./transition/fix-plan.js";

export { detectTechStack, customizeAgentMd } from "./transition/tech-stack.js";

export { findArtifactsDir, validateArtifacts } from "./transition/artifacts.js";

export {
  extractSection,
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
} from "./transition/context.js";

export { generateSpecsChangelog, formatChangelog } from "./transition/specs-changelog.js";

export { runTransition } from "./transition/orchestration.js";
