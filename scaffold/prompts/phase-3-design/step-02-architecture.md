# Phase 3 - Step 2: Architecture Design

## Agent
Continue as **Architect (Winston)**.

## Goal
Create the system architecture document with technology choices and component design.

## Instructions

1. Create `bmalph/artifacts/design/architecture.md` with:

### Architecture Document Structure
```markdown
# Architecture: {{PROJECT_NAME}}

## 1. System Overview
- High-level architecture diagram (text-based)
- Key components and their responsibilities
- System boundaries

## 2. Technology Stack
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | ... | ... |
| Backend | ... | ... |
| Database | ... | ... |
| Infrastructure | ... | ... |

## 3. Component Design
- Component boundaries and interfaces
- Communication patterns (sync/async)
- Data flow between components

## 4. Architecture Decisions
For each key decision:
- Decision: What was decided
- Context: Why this decision was needed
- Options Considered: Alternatives evaluated
- Rationale: Why this option was chosen
- Trade-offs: What we're accepting

## 5. Security Architecture
- Authentication/authorization approach
- Data protection strategy
- Input validation boundaries

## 6. Deployment Architecture
- Environment strategy (dev/staging/prod)
- CI/CD approach
- Scaling strategy
```

2. Justify every technology choice with rationale
3. Prefer boring, proven technology unless requirements demand otherwise
4. Connect decisions to requirements and constraints

## Scale Adaptation
- **Level 0-1:** Tech stack + key component overview, 1-2 ADRs
- **Level 2:** Full architecture doc with all sections
- **Level 3-4:** Detailed ADRs for each decision, sequence diagrams, failover design

## Output
Write to `bmalph/artifacts/design/architecture.md`

## Completion Signal
When architecture is documented, output:
```
STEP_COMPLETE
```
