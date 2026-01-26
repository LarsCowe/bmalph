import { describe, it, expect } from "vitest";
import {
  detectTechStack,
  customizeAgentMd,
} from "../../src/transition/tech-stack.js";

describe("tech-stack", () => {
  describe("detectTechStack", () => {
    it("detects Node.js from 'typescript' keyword", () => {
      const content = `# Architecture

## Tech Stack

- TypeScript
- Node.js 20+

## Components
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("npm install");
      expect(stack!.test).toBe("npm test");
      expect(stack!.build).toBe("npm run build");
      expect(stack!.dev).toBe("npm run dev");
    });

    it("detects Node.js from 'npm' keyword", () => {
      const content = `# Architecture

## Technology Stack

- npm packages
- React

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("npm install");
    });

    it("detects vitest test runner", () => {
      const content = `# Architecture

## Tech Stack

- TypeScript
- Vitest for testing

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.test).toBe("npx vitest run");
    });

    it("detects jest test runner", () => {
      const content = `# Architecture

## Tech Stack

- Node.js
- Jest

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.test).toBe("npx jest");
    });

    it("detects mocha test runner", () => {
      const content = `# Architecture

## Tech Stack

- TypeScript
- Mocha + Chai

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.test).toBe("npx mocha");
    });

    it("detects tsc build command", () => {
      const content = `# Architecture

## Tech Stack

- TypeScript
- tsc for compilation

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.build).toBe("npx tsc");
    });

    it("detects Python from 'python' keyword", () => {
      const content = `# Architecture

## Tech Stack

- Python 3.11
- FastAPI

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("pip install -r requirements.txt");
      expect(stack!.test).toBe("python -m pytest");
      expect(stack!.build).toBe("python -m build");
    });

    it("detects Python with pytest", () => {
      const content = `# Architecture

## Tech Stack

- Python
- pytest for testing

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.test).toBe("pytest");
    });

    it("detects Python with unittest", () => {
      const content = `# Architecture

## Tech Stack

- Python
- unittest

## Other
`;
      const stack = detectTechStack(content);
      expect(stack!.test).toBe("python -m unittest discover");
    });

    it("detects Rust from 'cargo' keyword", () => {
      const content = `# Architecture

## Tech Stack

- Rust
- cargo for package management

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("cargo build");
      expect(stack!.test).toBe("cargo test");
      expect(stack!.build).toBe("cargo build --release");
      expect(stack!.dev).toBe("cargo run");
    });

    it("detects Go from 'golang' keyword", () => {
      const content = `# Architecture

## Tech Stack

- Golang 1.21
- Standard library

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("go mod download");
      expect(stack!.test).toBe("go test ./...");
      expect(stack!.build).toBe("go build ./...");
      expect(stack!.dev).toBe("go run .");
    });

    it("returns null when no tech stack section found", () => {
      const content = `# Architecture

## Components

- Frontend
- Backend

## Deployment
`;
      const stack = detectTechStack(content);
      expect(stack).toBeNull();
    });

    it("returns null when tech stack section has unrecognized stack", () => {
      const content = `# Architecture

## Tech Stack

- Some Unknown Framework
- Mystery Language

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).toBeNull();
    });

    it("handles 'Stack' heading variant", () => {
      const content = `# Architecture

## Stack

- TypeScript
- Node.js

## Other
`;
      const stack = detectTechStack(content);
      expect(stack).not.toBeNull();
      expect(stack!.setup).toBe("npm install");
    });
  });

  describe("customizeAgentMd", () => {
    const template = `# @AGENT.md

## Project Setup

\`\`\`bash
echo "placeholder"
\`\`\`

## Running Tests

\`\`\`bash
echo "placeholder"
\`\`\`

## Build Commands

\`\`\`bash
echo "placeholder"
\`\`\`

## Development Server

\`\`\`bash
echo "placeholder"
\`\`\`

## Other Section

This content should remain unchanged.
`;

    it("replaces Project Setup code block", () => {
      const stack = {
        setup: "npm install",
        test: "npm test",
        build: "npm run build",
        dev: "npm run dev",
      };
      const result = customizeAgentMd(template, stack);
      expect(result).toContain("## Project Setup\n\n```bash\nnpm install\n```");
    });

    it("replaces Running Tests code block", () => {
      const stack = {
        setup: "pip install -r requirements.txt",
        test: "pytest",
        build: "python -m build",
        dev: "uvicorn main:app",
      };
      const result = customizeAgentMd(template, stack);
      expect(result).toContain("## Running Tests\n\n```bash\npytest\n```");
    });

    it("replaces Build Commands code block", () => {
      const stack = {
        setup: "cargo build",
        test: "cargo test",
        build: "cargo build --release",
        dev: "cargo run",
      };
      const result = customizeAgentMd(template, stack);
      expect(result).toContain(
        "## Build Commands\n\n```bash\ncargo build --release\n```"
      );
    });

    it("replaces Development Server code block", () => {
      const stack = {
        setup: "go mod download",
        test: "go test ./...",
        build: "go build ./...",
        dev: "go run .",
      };
      const result = customizeAgentMd(template, stack);
      expect(result).toContain(
        "## Development Server\n\n```bash\ngo run .\n```"
      );
    });

    it("preserves other content unchanged", () => {
      const stack = {
        setup: "npm install",
        test: "npm test",
        build: "npm run build",
        dev: "npm run dev",
      };
      const result = customizeAgentMd(template, stack);
      expect(result).toContain("## Other Section");
      expect(result).toContain("This content should remain unchanged.");
    });

    it("handles template without matching sections", () => {
      const minimalTemplate = `# @AGENT.md

Some content without the expected sections.
`;
      const stack = {
        setup: "npm install",
        test: "npm test",
        build: "npm run build",
        dev: "npm run dev",
      };
      const result = customizeAgentMd(minimalTemplate, stack);
      expect(result).toBe(minimalTemplate);
    });

    it("replaces all sections in a single pass", () => {
      const stack = {
        setup: "npm install",
        test: "npx vitest run",
        build: "npx tsc",
        dev: "npm run dev",
      };
      const result = customizeAgentMd(template, stack);

      expect(result).toContain("npm install");
      expect(result).toContain("npx vitest run");
      expect(result).toContain("npx tsc");
      expect(result).toContain("npm run dev");
      expect(result).not.toContain('echo "placeholder"');
    });
  });
});
