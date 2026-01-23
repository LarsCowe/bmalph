# Phase 3 - Step 4: Coding Conventions & Standards

## Agent
Continue as **Architect (Winston)**.

## Goal
Define coding conventions and project structure standards for implementation.

## Instructions

1. Create `bmalph/artifacts/design/conventions.md` with:

### Conventions Document Structure
```markdown
# Coding Conventions: {{PROJECT_NAME}}

## 1. Project Structure
- Directory layout
- File naming conventions
- Module organization

## 2. Code Style
- Language-specific style rules
- Formatting standards (tool references)
- Import ordering

## 3. Naming Conventions
- Variables, functions, classes
- Files and directories
- Constants and enums
- Database fields

## 4. Patterns & Practices
- Error handling pattern
- Logging approach
- Configuration management
- Environment variables

## 5. Testing Standards
- Test file location and naming
- Test structure (Arrange/Act/Assert)
- Minimum coverage expectations
- Mock/stub conventions

## 6. Git Conventions
- Branch naming
- Commit message format
- PR requirements
```

2. Base conventions on the chosen technology stack
3. Keep rules minimal but clear - enough to maintain consistency
4. Reference existing tooling (ESLint, Prettier, etc.) where applicable

## Scale Adaptation
- **Level 0-1:** Minimal conventions (project structure + key patterns only)
- **Level 2:** Standard conventions covering all sections
- **Level 3-4:** Detailed with examples for each pattern, ADR references

## Output
Write to `bmalph/artifacts/design/conventions.md`

## Completion Signal
When conventions are documented, output:
```
STEP_COMPLETE
```
