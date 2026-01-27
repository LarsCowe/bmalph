import type { TechStack } from "./types.js";

export function detectTechStack(content: string): TechStack | null {
  // Find tech stack section
  const stackMatch = content.match(/^##\s+(?:Tech(?:nology)?\s+Stack|Stack)/im);
  if (!stackMatch) return null;

  const startIndex = stackMatch.index!;
  // Extract section content until next ## heading or end
  const rest = content.slice(startIndex);
  const nextHeading = rest.slice(1).search(/^##\s/m);
  const sectionContent = nextHeading > -1 ? rest.slice(0, nextHeading + 1) : rest;

  // Detect language/runtime
  const isNode =
    /\bnode(?:\.js)?\b/i.test(sectionContent) ||
    /\btypescript\b/i.test(sectionContent) ||
    /\bnpm\b/i.test(sectionContent);
  const isPython = /\bpython\b/i.test(sectionContent) || /\bpip\b/i.test(sectionContent);
  const isRust = /\brust\b/i.test(sectionContent) || /\bcargo\b/i.test(sectionContent);
  const isGo = /\bgo\b/i.test(sectionContent) || /\bgolang\b/i.test(sectionContent);

  if (isNode) {
    // Detect specific test runner
    let testCmd = "npm test";
    if (/\bvitest\b/i.test(sectionContent)) testCmd = "npx vitest run";
    else if (/\bjest\b/i.test(sectionContent)) testCmd = "npx jest";
    else if (/\bmocha\b/i.test(sectionContent)) testCmd = "npx mocha";

    // Detect build command
    let buildCmd = "npm run build";
    if (/\btsc\b/i.test(sectionContent)) buildCmd = "npx tsc";

    return { setup: "npm install", test: testCmd, build: buildCmd, dev: "npm run dev" };
  }

  if (isPython) {
    let testCmd = "python -m pytest";
    if (/\bpytest\b/i.test(sectionContent)) testCmd = "pytest";
    else if (/\bunittest\b/i.test(sectionContent)) testCmd = "python -m unittest discover";

    return {
      setup: "pip install -r requirements.txt",
      test: testCmd,
      build: "python -m build",
      dev: "python -m uvicorn main:app --reload",
    };
  }

  if (isRust) {
    return {
      setup: "cargo build",
      test: "cargo test",
      build: "cargo build --release",
      dev: "cargo run",
    };
  }

  if (isGo) {
    return {
      setup: "go mod download",
      test: "go test ./...",
      build: "go build ./...",
      dev: "go run .",
    };
  }

  return null;
}

export function customizeAgentMd(template: string, stack: TechStack): string {
  const sections: { heading: string; command: string }[] = [
    { heading: "Project Setup", command: stack.setup },
    { heading: "Running Tests", command: stack.test },
    { heading: "Build Commands", command: stack.build },
    { heading: "Development Server", command: stack.dev },
  ];

  let result = template;
  for (const { heading, command } of sections) {
    // Replace code block content after the section heading
    const pattern = new RegExp(
      `(## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n)\`\`\`bash\\n[\\s\\S]*?\`\`\``,
      "m"
    );
    result = result.replace(pattern, `$1\`\`\`bash\n${command}\n\`\`\``);
  }

  return result;
}
