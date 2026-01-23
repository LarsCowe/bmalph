# Phase 1 - Step 3: Requirements Elicitation

## Agent
Continue as **Analyst (Mary)**.

## Goal
Extract and structure all functional and non-functional requirements.

## Instructions

1. Based on research and project context, extract requirements:
   - **Functional Requirements:** What the system must do
   - **Non-Functional Requirements:** Performance, security, scalability, accessibility
   - **User Requirements:** What users need to accomplish
2. For each requirement:
   - Assign a unique ID (FR-001, NFR-001, etc.)
   - Write as testable/verifiable statement
   - Assign priority (Must/Should/Could/Won't)
   - Label assumptions explicitly
   - Note dependencies
3. Identify gaps or ambiguities that need human input
4. Write to `bmalph/artifacts/analysis/requirements.md`

## Scale Adaptation
- **Level 0-1:** Core requirements only (5-15 items), focus on Must-haves
- **Level 2:** Standard requirements (15-30 items), Must + Should
- **Level 3-4:** Comprehensive requirements (30+), full MoSCoW, trace to research

## Output
Write structured requirements to `bmalph/artifacts/analysis/requirements.md`

## Completion Signal
When requirements are documented, output:
```
STEP_COMPLETE
```

If critical ambiguities need human input, output:
```
<needs-human>
[List the specific questions that need answers]
</needs-human>
```
