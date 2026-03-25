---
paths:
  - "src/installer/commands.ts"
  - "src/installer/metadata.ts"
  - "src/platform/**"
  - "slash-commands/**"
---

# Command Delivery

bmalph bundles 54 BMAD and bmalph command definitions. Delivery varies by platform:

- **Claude Code** — `.claude/commands/` slash commands
- **OpenAI Codex** — `.agents/skills/` Codex Skills
- **OpenCode** — `.opencode/skills/` OpenCode Skills
- **Cursor, Windsurf, Copilot, Aider** — `_bmad/COMMANDS.md` reference index

Key commands in Claude Code syntax:

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `/bmalph`               | BMAD master agent — navigate phases |
| `/analyst`              | Analyst agent                       |
| `/pm`                   | Product Manager agent               |
| `/architect`            | Architect agent                     |
| `/create-prd`           | Create PRD workflow                 |
| `/create-architecture`  | Create architecture workflow        |
| `/create-epics-stories` | Create epics and stories            |
| `/dev`                  | Developer agent                     |
| `/sm`                   | Scrum Master agent                  |
| `/qa`                   | QA agent                            |
| `/ux-designer`          | UX Designer agent                   |
| `/tech-writer`          | Tech Writer agent                   |
| `/quick-flow-solo-dev`  | Quick Flow solo developer agent     |
| `/bmalph-watch`         | Launch Ralph live dashboard         |
| `/bmad-help`            | List all BMAD commands              |

For the full list, run `/bmad-help` in Claude Code or inspect `_bmad/COMMANDS.md` / `.agents/skills/` for the other platforms.

## Transition to Ralph

Use `bmalph implement` (or `/bmalph-implement`) to transition from BMAD planning to Ralph implementation.
