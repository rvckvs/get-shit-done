# Architecture

> For a full technical deep-dive (installation pipeline, library module API, data model, hooks), see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Overview

GSD is a CLI tool and prompt library. The installer writes prompt files and hook scripts into the user's AI coding runtime. Once installed, all commands run entirely within the AI agent's context — no server, no daemon.

## Component Map

```
bin/install.js
  └── Reads: commands/gsd/*.md, get-shit-done/**, agents/**, hooks/dist/**
  └── Writes: to ~/.claude/ (or ~/.opencode/, ~/.gemini/, etc.)

commands/gsd/*.md                    ← Thin entry-point prompts
  └── Reference: get-shit-done/workflows/*.md

get-shit-done/workflows/*.md         ← Full workflow logic consumed at command invocation
  └── Call: gsd-tools.cjs (via Bash tool)
  └── Spawn: named subagents

get-shit-done/bin/gsd-tools.cjs      ← Single multi-command CLI binary
  └── Delegates to: get-shit-done/bin/lib/*.cjs

get-shit-done/bin/lib/*.cjs          ← Library modules
  ├── core.cjs        Config, path utils, model profiles, milestone/phase helpers
  ├── commands.cjs    Dispatch table + input validation for gsd-tools.cjs
  ├── config.cjs      Config read/write (config-get, config-set)
  ├── frontmatter.cjs Agent frontmatter parsing
  ├── init.cjs        Per-command init payload generation
  ├── milestone.cjs   Milestone lifecycle helpers
  ├── phase.cjs       Phase discovery, numbering, slug generation
  ├── roadmap.cjs     ROADMAP.md parsing
  ├── state.cjs       STATE.md read/write
  ├── template.cjs    Template file rendering
  └── verify.cjs      Verify-phase / health-check logic
```

## `.planning/` Directory (User's Project)

GSD writes all project state into `.planning/` inside the user's project:

```
.planning/
├── config.json           ← GSD config (model profile, feature flags)
├── PROJECT.md            ← Living project description and requirements
├── REQUIREMENTS.md       ← Detailed requirements list
├── ROADMAP.md            ← Phases and milestones
├── STATE.md              ← Current execution state
├── CODEBASE.md           ← (Optional) Codebase map from /gsd:map-codebase
└── phases/
    └── 01-phase-name/
        ├── 01-CONTEXT.md     ← Implementation decisions gathered in discuss-phase
        ├── RESEARCH.md       ← Phase research output
        ├── VALIDATION.md     ← Nyquist test coverage map
        ├── 01-01-plan.md     ← Individual plan files
        └── 01-01-SUMMARY.md  ← Execution summary per plan
```

## Data Flow: Command Execution

```
User types /gsd:plan-phase 3
    │
    ├─ commands/gsd/plan-phase.md (entry prompt)
    │   └─ Loads: workflows/plan-phase.md (full logic)
    │
    ├─ workflow calls gsd-tools.cjs init plan-phase 3
    │   └─ Returns JSON: executor_model, phase_dir, roadmap phases, config flags…
    │
    ├─ workflow spawns gsd-phase-researcher (×4 parallel)
    │   └─ Writes: RESEARCH.md
    │
    ├─ workflow spawns gsd-planner
    │   └─ Reads: PROJECT.md, REQUIREMENTS.md, RESEARCH.md, CONTEXT.md
    │   └─ Writes: 0N-0M-plan.md files
    │
    └─ workflow spawns gsd-plan-checker
        └─ Validates plan quality (8 dimensions incl. Nyquist)
        └─ Loops up to 3× until PASS
```

## Data Flow: gsd-tools.cjs

All commands share a single binary entry point:

```bash
node gsd-tools.cjs <command> [args...]
```

`commands.cjs` holds the dispatch table. Each command validates its arguments and delegates to a module in `lib/`. Output is always JSON (stdout), errors go to stderr. Payloads >50 KB are written to a temp file and returned as `@file:/tmp/gsd-*.json`.

## Subagents

Named agents are defined in `agents/` (`.agent.md` files). Each agent file contains:

- `description` — what the agent does
- `tools` — allowed tools for that agent
- Model profile assignment via `gsd-tools.cjs resolve-model`

The orchestrating workflow spawns agents using the AI runtime's native `Task` or equivalent primitive, passing the relevant workflow markdown as the system/task prompt.

## Hooks

Two runtime hooks are distributed in `hooks/dist/` and registered during install:

| Hook | Event | Purpose |
|------|-------|---------|
| `gsd-statusline.js` | `statusLine` (Claude) | Writes context metrics to `/tmp/claude-ctx-{session}.json` |
| `gsd-context-monitor.js` | `PostToolUse` / `AfterTool` | Reads metrics, injects WARNING/CRITICAL if context is low |

Hooks are built from source in `hooks/` via `npm run build:hooks` (esbuild).

## Model Profiles

`core.cjs` exports `MODEL_PROFILES` — a map of agent name → `{quality, balanced, budget}` model IDs. The active profile (`quality` / `balanced` / `budget`) is read from `config.json`. Individual agents can be overridden via `model_overrides` in config.

## Cross-Platform Notes

- All user-facing paths use forward slashes (via `toPosixPath`)
- Installer handles Windows backslash paths and `$HOME` vs `%USERPROFILE%`
- Shell snippets in workflow files use `printf` instead of `echo` to avoid jq parse issues
- Tests use `node:test` (no external test runner) for broad Node.js version compatibility
