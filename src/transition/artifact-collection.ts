export interface TransitionArtifactGroup {
  label: string;
  files: string[];
}

export interface CollectedTransitionArtifacts {
  files: string[];
  prdFiles: string[];
  prdDocuments: TransitionArtifactGroup[];
  architectureFiles: string[];
  readinessFiles: string[];
  storyFiles: string[];
  sprintStatusFile: string | null;
}

function sortFiles(files: string[]): string[] {
  return [...files].sort((left, right) => left.localeCompare(right));
}

function isMarkdownFile(file: string): boolean {
  return /\.md$/i.test(file);
}

function hasSeparatedToken(file: string, expression: string): boolean {
  return new RegExp(`(?:^|[\\/._-])${expression}(?=$|[\\/._-])`, "i").test(file);
}

function isPrdPath(file: string): boolean {
  return hasSeparatedToken(file, "prd");
}

function isPrdFile(file: string): boolean {
  return isPrdPath(file) && isMarkdownFile(file);
}

function isPrdDocumentDirectory(segment: string): boolean {
  return isPrdPath(segment);
}

function isArchitectureFile(file: string): boolean {
  return /architect/i.test(file) && isMarkdownFile(file);
}

function isReadinessFile(file: string): boolean {
  return /readiness/i.test(file) && isMarkdownFile(file);
}

function isStoryFile(file: string): boolean {
  return (
    (hasSeparatedToken(file, "epics?") || hasSeparatedToken(file, "stor(?:y|ies)")) &&
    isMarkdownFile(file)
  );
}

function isSprintStatusFile(file: string): boolean {
  return /(?:^|\/)sprint[-_]status\.ya?ml$/i.test(file);
}

function topLevelSegment(file: string): string {
  return file.split("/")[0] ?? file;
}

function buildArtifactGroups(
  files: string[],
  matchesGroupDirectory: (segment: string) => boolean
): TransitionArtifactGroup[] {
  const groupedFiles = new Map<string, string[]>();

  for (const file of files) {
    const topLevel = topLevelSegment(file);
    const key = file.includes("/") && matchesGroupDirectory(topLevel) ? topLevel : file;
    const existingGroup = groupedFiles.get(key);

    if (existingGroup) {
      existingGroup.push(file);
      continue;
    }

    groupedFiles.set(key, [file]);
  }

  return [...groupedFiles.entries()]
    .map(([label, groupFiles]) => ({
      label,
      files: sortFiles(groupFiles),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function collectTransitionArtifacts(files: string[]): CollectedTransitionArtifacts {
  const sortedFiles = sortFiles(files);
  const prdFiles = sortedFiles.filter(isPrdFile);
  const sprintStatusFiles = sortedFiles.filter(isSprintStatusFile);

  return {
    files: sortedFiles,
    prdFiles,
    prdDocuments: buildArtifactGroups(prdFiles, isPrdDocumentDirectory),
    architectureFiles: sortedFiles.filter(isArchitectureFile),
    readinessFiles: sortedFiles.filter(isReadinessFile),
    storyFiles: sortedFiles.filter(isStoryFile),
    sprintStatusFile: sprintStatusFiles[0] ?? null,
  };
}

export function combineArtifactContents(
  files: string[],
  artifactContents: ReadonlyMap<string, string>
): string {
  return files
    .map((file) => artifactContents.get(file)?.trim())
    .filter((content): content is string => Boolean(content))
    .join("\n\n");
}
