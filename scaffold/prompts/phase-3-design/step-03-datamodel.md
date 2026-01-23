# Phase 3 - Step 3: Data Model & API Design

## Agent
Continue as **Architect (Winston)**.

## Goal
Design the data model and API contracts.

## Instructions

### Data Model
1. Create `bmalph/artifacts/design/data-model.md`:
   - Entity definitions with fields and types
   - Relationships between entities
   - Indexes and constraints
   - Migration strategy (if applicable)
   - Data validation rules

2. For each entity:
   ```markdown
   ### Entity: [Name]
   | Field | Type | Required | Description |
   |-------|------|----------|-------------|
   | id | UUID | Yes | Primary key |
   | ... | ... | ... | ... |

   **Relationships:** ...
   **Indexes:** ...
   **Constraints:** ...
   ```

### API Design (if applicable)
3. Create `bmalph/artifacts/design/api-design.md`:
   - Endpoint definitions (method, path, purpose)
   - Request/response shapes
   - Authentication requirements per endpoint
   - Error response format
   - Versioning strategy

4. For each endpoint:
   ```markdown
   ### [METHOD] /api/[path]
   **Purpose:** ...
   **Auth:** Required/Public
   **Request:** { ... }
   **Response:** { ... }
   **Errors:** [list of possible errors]
   ```

## Scale Adaptation
- **Level 0-1:** Core entities + key endpoints only
- **Level 2:** Full data model + all CRUD endpoints
- **Level 3-4:** Complete with relationships, indexes, pagination, filtering, webhooks

## Output
- `bmalph/artifacts/design/data-model.md`
- `bmalph/artifacts/design/api-design.md` (if applicable)

## Completion Signal
When data model and API design are documented, output:
```
STEP_COMPLETE
```
