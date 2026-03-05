# GSD Commands Reference

All commands are invoked as slash commands in the AI coding runtime. Replace `/gsd:` with the runtime-specific prefix for OpenCode (`/gsd-`) or Codex (`$gsd-`).

## Project Lifecycle

### `/gsd:new-project`
Initialize a new project. Runs deep questioning, research, and generates PROJECT.md, REQUIREMENTS.md, ROADMAP.md.

Flags:
- `--auto @file.md` — non-interactive mode, reads idea from a document

### `/gsd:new-milestone`
Start a new milestone after the current one is complete. Generates a fresh roadmap scoped to the next goal.

### `/gsd:progress`
Show current project state: active milestone, phases done/remaining, last executed plan.

### `/gsd:resume-work`
Resume after a break. Loads STATE.md and orients the agent to what was happening.

### `/gsd:pause-work`
Save execution state before ending a session. Writes a checkpoint to STATE.md.

### `/gsd:cleanup`
Remove stale or redundant planning artifacts.

---

## Phase Workflow

### `/gsd:discuss-phase [N]`
Gather implementation decisions for phase N before planning. Produces `CONTEXT.md` for the phase. Prevents the planner from asking questions you've already answered.

### `/gsd:plan-phase [N]`
Research + plan phase N. Spawns parallel researchers and the planner subagent. Produces plan files and `VALIDATION.md` (Nyquist coverage map).

### `/gsd:execute-phase [N]`
Execute all plans in phase N using wave-based parallel execution.

Flags:
- `--auto` — continue automatically to the next phase after completion

### `/gsd:verify-work`
Manual UAT workflow. Checks the last executed phase against its requirements.

### `/gsd:validate-phase [N]`
Retroactively audit and fill test coverage gaps for phase N (for phases executed before Nyquist validation existed).

### `/gsd:complete-milestone`
Mark the current milestone as complete. Archives phase summaries, updates STATE.md.

### `/gsd:audit-milestone`
Audit the current milestone for quality, coverage gaps, and Nyquist compliance.

---

## Phase Management

### `/gsd:add-phase`
Insert a new phase into the roadmap.

### `/gsd:insert-phase`
Insert a phase between two existing phases (renumbers subsequent phases).

### `/gsd:remove-phase [N]`
Remove a phase from the roadmap.

### `/gsd:plan-milestone-gaps`
Identify and plan phases to fill gaps in the current milestone.

### `/gsd:list-phase-assumptions [N]`
List assumptions the planner made for phase N (useful for catching hallucinations).

---

## Development Helpers

### `/gsd:quick`
Quick task execution outside the normal phase workflow — for small fixes and one-offs.

Flags:
- `--discuss` — lightweight discussion before execution to gather context

### `/gsd:add-todo`
Add a todo item to the planning backlog.

### `/gsd:check-todos`
Review and triage the todo backlog.

### `/gsd:add-tests`
Add automated tests for a phase or specific functionality.

### `/gsd:debug`
Debug a failing test or unexpected behavior. Spawns the gsd-debugger subagent.

### `/gsd:research-phase [N]`
Run only the research step for a phase (without planning).

### `/gsd:discuss-phase [N]`
Gather implementation decisions interactively before planning begins.

---

## Codebase & Analysis

### `/gsd:map-codebase`
Generate a CODEBASE.md map of the current codebase. Used for brownfield projects before initialization.

### `/gsd:health`
Health check: validate `.planning/` structure, detect corruption, check config.

### `/gsd:verify-work`
Manual UAT: verify the last executed phase meets its requirements.

---

## Config & Setup

### `/gsd:settings`
View or change GSD configuration (model profile, feature flags, branching strategy, etc.).

### `/gsd:set-profile [quality|balanced|budget]`
Shortcut to set the model profile.

### `/gsd:update`
Check for and apply GSD updates.

### `/gsd:help`
Show the full command reference within the AI runtime.

### `/gsd:join-discord`
Get the link to the GSD Discord community.

---

## Config Keys (`config.json`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `model_profile` | string | `balanced` | `quality`, `balanced`, or `budget` |
| `model_overrides` | object | `{}` | Per-agent model overrides |
| `granularity` | string | `standard` | `coarse`, `standard`, or `fine` — controls phase count |
| `commit_docs` | bool | `true` | Auto-commit .planning/ changes |
| `research` | bool | `true` | Run researchers during plan-phase |
| `plan_checker` | bool | `true` | Run plan checker after planning |
| `verifier` | bool | `true` | Run verifier during verify-work |
| `nyquist_validation` | bool | `true` | Generate VALIDATION.md during plan-phase |
| `parallelization` | bool | `true` | Execute plans in parallel within a wave |
| `branching_strategy` | string | `none` | `none`, `phase`, or `milestone` |
| `brave_search` | bool | `false` | Use Brave Search in research agents |
| `auto_advance` | bool | `false` | Automatically advance to next phase after execution |
