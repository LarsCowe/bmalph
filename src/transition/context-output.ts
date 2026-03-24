import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { debug, info, warn } from "../utils/logger.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { atomicWriteFile, exists } from "../utils/file-system.js";
import { readConfig } from "../utils/config.js";
import { combineArtifactContents } from "./artifact-collection.js";
import {
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
  detectTruncation,
} from "./context.js";
import { detectTechStack, customizeAgentMd } from "./tech-stack.js";
import type { GeneratedFile } from "./types.js";
import type { LoadedTransitionInputs } from "./artifact-loading.js";

export interface ContextOutputResult {
  warnings: string[];
  generatedFiles: GeneratedFile[];
}

export async function generateContextOutputs(
  projectDir: string,
  inputs: LoadedTransitionInputs
): Promise<ContextOutputResult> {
  const generatedFiles: GeneratedFile[] = [];
  let projectName = "project";

  try {
    const config = await readConfig(projectDir);
    if (config?.name) {
      projectName = config.name;
    }
  } catch (err) {
    debug(`Could not read config for project name: ${formatError(err)}`);
  }

  info("Generating PROJECT_CONTEXT.md...");
  const projectContextPath = join(projectDir, ".ralph/PROJECT_CONTEXT.md");
  const projectContextExisted = await exists(projectContextPath);
  let truncationWarnings: string[] = [];

  if (inputs.artifactContents.size > 0) {
    const { context, truncated } = extractProjectContext(inputs.artifactContents);
    truncationWarnings = detectTruncation(truncated);
    const contextMd = generateProjectContextMd(context, projectName);
    await atomicWriteFile(projectContextPath, contextMd);
    generatedFiles.push({
      path: ".ralph/PROJECT_CONTEXT.md",
      action: projectContextExisted ? "updated" : "created",
    });
    debug("Generated PROJECT_CONTEXT.md");
  }

  info("Generating PROMPT.md...");
  let prompt: string;
  let promptExisted = false;
  try {
    const existingPrompt = await readFile(join(projectDir, ".ralph/PROMPT.md"), "utf-8");
    promptExisted = true;
    if (existingPrompt.includes("[YOUR PROJECT NAME]")) {
      prompt = existingPrompt.replace(/\[YOUR PROJECT NAME\]/g, projectName);
    } else {
      prompt = generatePrompt(projectName);
    }
  } catch (err) {
    if (isEnoent(err)) {
      debug("No existing PROMPT.md found, generating from template");
    } else {
      warn(`Could not read existing PROMPT.md: ${formatError(err)}`);
    }
    prompt = generatePrompt(projectName);
  }
  await atomicWriteFile(join(projectDir, ".ralph/PROMPT.md"), prompt);
  generatedFiles.push({ path: ".ralph/PROMPT.md", action: promptExisted ? "updated" : "created" });

  const combinedArchitectureContent = combineArtifactContents(
    inputs.collectedArtifacts.architectureFiles,
    inputs.artifactContents
  );
  if (combinedArchitectureContent) {
    try {
      const stack = detectTechStack(combinedArchitectureContent);
      if (stack) {
        const agentPath = join(projectDir, ".ralph/@AGENT.md");
        const agentTemplate = await readFile(agentPath, "utf-8");
        const customized = customizeAgentMd(agentTemplate, stack);
        await atomicWriteFile(agentPath, customized);
        generatedFiles.push({ path: ".ralph/@AGENT.md", action: "updated" });
        debug("Customized @AGENT.md with detected tech stack");
      }
    } catch (err) {
      warn(`Could not customize @AGENT.md: ${formatError(err)}`);
    }
  }

  return {
    warnings: truncationWarnings,
    generatedFiles,
  };
}
