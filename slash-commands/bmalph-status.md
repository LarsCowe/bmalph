# bmalph Status

Show current project status.

## Steps

1. **Read project configuration**
   Read `bmalph/config.json` and extract:
   - Project name
   - Description

2. **Read project state**
   Read `bmalph/state/current-phase.json` and extract:
   - Current phase (1-4)
   - Status (planning/implementing/completed)
   - Last updated timestamp

3. **Show phase information**
   Based on the current phase, show available commands:

   **Phase 1 - Analysis:**
   | Command | Task | Description |
   |---------|------|-------------|
   | `/brainstorm-project` | BP | Expert guided facilitation through brainstorming techniques |
   | `/market-research` | MR | Market analysis, competitive landscape, customer needs |
   | `/domain-research` | DR | Industry domain deep dive, subject matter expertise |
   | `/technical-research` | TR | Technical feasibility, architecture options |
   | `/create-brief` | CB | Guided experience to nail down your product idea |
   | `/validate-brief` | VB | Validates product brief completeness |

   **Phase 2 - Planning:**
   | Command | Task | Description |
   |---------|------|-------------|
   | `/create-prd` | CP | Expert led facilitation to produce your PRD |
   | `/validate-prd` | VP | Validate PRD is comprehensive and cohesive |
   | `/create-ux` | CU | Guidance through realizing the plan for your UX |
   | `/validate-ux` | VU | Validates UX design deliverables |

   **Phase 3 - Solutioning:**
   | Command | Task | Description |
   |---------|------|-------------|
   | `/create-architecture` | CA | Guided workflow to document technical decisions |
   | `/validate-architecture` | VA | Validates architecture completeness |
   | `/create-epics-stories` | CE | Create the epics and stories listing |
   | `/validate-epics-stories` | VE | Validates epics and stories completeness |
   | `/test-design` | TD | Create comprehensive test scenarios |
   | `/implementation-readiness` | IR | Ensure PRD, UX, architecture, and stories are aligned |

   **Phase 4 - Implementation:**
   Ralph loop is active. Use `/bmalph-implement` to start the loop.

4. **Show Ralph progress** (if in Phase 4)
   If `.ralph/logs/` exists and contains logs, show Ralph progress:
   - Loop count
   - Tasks completed / total
   - Last activity timestamp

## Output Format

```
Project: [name]
Phase:   [1-4] — [Analysis/Planning/Solutioning/Implementation]
Status:  [planning/implementing/completed]
Updated: [time ago]

Ralph:   [not_started/running/blocked/completed]
         iterations: [n], tasks: [completed]/[total]
```
