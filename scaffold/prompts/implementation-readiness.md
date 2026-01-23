# Implementation Readiness Gate

This gate runs between Phase 3 (Design) and Phase 4 (Implementation) to ensure all artifacts are aligned and complete enough for development to begin.

## Agent
Use **Product Manager (John)** and **Architect (Winston)** perspectives.

## Context
**Project:** {{PROJECT_NAME}}
**Scale Level:** {{SCALE_LEVEL}}

## Assessment Criteria

### 1. Document Completeness
- [ ] PRD exists and has all required sections
- [ ] User stories exist with acceptance criteria
- [ ] MVP scope is defined
- [ ] Architecture document exists
- [ ] Data model is defined
- [ ] Coding conventions are documented
- [ ] Task breakdown exists in phase-4-tasks.json

### 2. PRD-to-Architecture Alignment
- [ ] Every functional requirement has a corresponding architectural component
- [ ] Non-functional requirements are addressed in architecture decisions
- [ ] Technology choices support all PRD requirements
- [ ] Data model supports all user stories

### 3. Story-to-Task Alignment
- [ ] Every MVP story has corresponding implementation tasks
- [ ] Tasks are ordered respecting dependencies
- [ ] No circular dependencies exist
- [ ] Each task is small enough to implement in one iteration

### 4. Constraint Satisfaction
- [ ] Architecture respects all documented constraints
- [ ] Technology choices align with technical constraints
- [ ] Security requirements have architectural support
- [ ] Scalability approach matches requirements

### 5. Risk Mitigation
- [ ] Each high-priority risk has an architectural mitigation
- [ ] No unaddressed blockers remain
- [ ] Fallback strategies exist for key technical risks

## Verdict

### PASS Criteria
All checkboxes must be satisfied. Minor gaps can be noted but must not block implementation.

### FAIL Criteria
Any of these blocks progression:
- Missing critical artifacts (PRD, architecture, task list)
- Unresolved conflicts between requirements and design
- Tasks without clear acceptance criteria
- High-priority risks without mitigation

## Output

If PASS:
```
<implementation-ready>
```

If FAIL:
```
<implementation-not-ready>
[List of blocking issues that must be resolved]
</implementation-not-ready>
```
