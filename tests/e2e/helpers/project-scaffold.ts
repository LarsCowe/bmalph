import { mkdir, rm, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export interface TestProject {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Create a unique temporary directory for testing
 */
export async function createTestProject(prefix = "bmalph-e2e"): Promise<TestProject> {
  const path = join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(path, { recursive: true });

  return {
    path,
    cleanup: async () => {
      // Retry cleanup for Windows file locking issues
      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          await rm(path, { recursive: true, force: true });
          break;
        } catch {
          attempts++;
          if (attempts < maxAttempts) {
            await sleep(100);
          }
          // Silently ignore cleanup failures on last attempt
        }
      }
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a file in the test project
 */
export async function createFile(
  projectPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const fullPath = join(projectPath, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf(/[/\\]/.test(fullPath) ? /[/\\]/.exec(fullPath)![0] : "/"));
  await mkdir(dir, { recursive: true }).catch(() => {});
  await writeFile(fullPath, content, "utf-8");
}

/**
 * Read a file from the test project
 */
export async function readProjectFile(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  return readFile(join(projectPath, relativePath), "utf-8");
}

/**
 * Create a test project with existing CLAUDE.md
 */
export async function createProjectWithClaudeMd(
  existingContent: string,
): Promise<TestProject> {
  const project = await createTestProject();
  await createFile(project.path, "CLAUDE.md", existingContent);
  return project;
}

/**
 * Create a test project with existing .gitignore
 */
export async function createProjectWithGitignore(
  existingContent: string,
): Promise<TestProject> {
  const project = await createTestProject();
  await createFile(project.path, ".gitignore", existingContent);
  return project;
}

/**
 * Create a test project with user files in .ralph directory
 */
export async function createProjectWithRalphUserFiles(
  userFiles: Record<string, string>,
): Promise<TestProject> {
  const project = await createTestProject();
  for (const [relativePath, content] of Object.entries(userFiles)) {
    await createFile(project.path, relativePath, content);
  }
  return project;
}
