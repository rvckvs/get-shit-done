# Get Shit Done (GSD)

## What This Is

GSD is a lightweight, powerful meta-prompting, context engineering, and spec-driven development system for AI coding agents — Claude Code, OpenCode, Gemini CLI, and Codex. It solves context rot: the quality degradation that happens as an AI agent fills its context window over a long session.

## Core Value

Give an AI agent a clear structure, deep context, and a verified plan so it can build reliably — without enterprise theater.

## Purpose

GSD is an NPM package (`get-shit-done-cc`) that installs a set of slash commands (`/gsd:*`), agent definitions, and hooks into the user's AI coding environment. Users describe what they want to build and GSD handles context engineering, research, spec generation, phased planning, and verified execution.

## Key Features

- **Context engineering** — Structured `.planning/` directory keeps project context fresh and accessible across sessions
- **Spec-driven development** — PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and per-phase plans anchor every action
- **Multi-agent orchestration** — Named subagents (`gsd-planner`, `gsd-executor`, `gsd-phase-researcher`, etc.) run in parallel waves
- **Context rot prevention** — State management, pause/resume, and context monitoring hooks keep agents on track
- **Cross-platform** — Works on macOS, Windows, and Linux across all supported runtimes
- **Nyquist Validation** — Maps automated test coverage to each requirement before any code is written

## Tech Stack

- **Runtime**: Node.js (>=16.7.0)
- **Language**: CommonJS (`.cjs`) for library modules, plain Node.js scripts for tooling
- **Package manager**: npm
- **Build**: esbuild (for hooks bundling via `scripts/build-hooks.js`)
- **Testing**: Node.js built-in `node:test` runner, c8 for coverage
- **Hooks**: PostToolUse / AfterTool hooks injected into the user's AI runtime settings

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Slash commands as markdown prompt files | Portable, readable, no runtime coupling |
| `.planning/` directory for state | Colocated with the project, git-trackable |
| CommonJS for lib modules | Maximum Node.js compatibility (>=16.7.0) |
| No external runtime dependencies | Reduces install friction and supply-chain risk |
| Subagent model profiles configurable | Lets users balance quality vs. cost |
| Nyquist validation layer | Ensures executable plans have automated verification before code is written |

## Project Structure

```
get-shit-done/
├── bin/
│   └── install.js          # npx entry point — interactive installer
├── commands/gsd/           # User-facing slash command prompt files (.md)
├── get-shit-done/
│   ├── bin/
│   │   ├── gsd-tools.cjs   # CLI tool invoked by slash commands for state/config ops
│   │   └── lib/            # Shared library modules (core, config, state, phase, etc.)
│   ├── templates/          # Document templates (project.md, context.md, milestone.md, …)
│   ├── references/         # Internal reference docs for workflow logic
│   └── workflows/          # Per-command workflow definitions consumed by slash commands
├── agents/                 # Agent definition files (.agent.md)
├── hooks/                  # Runtime hooks (statusline, context monitor)
├── scripts/                # Build and test runner scripts
├── tests/                  # Test suite (node:test, *.test.cjs)
└── docs/                   # User-facing documentation
```

## Installed Artifacts

After `npx get-shit-done-cc@latest`, the following are written to the user's environment:

| Runtime | Commands location | Hooks location |
|---------|------------------|----------------|
| Claude Code (global) | `~/.claude/commands/gsd/` | `~/.claude/hooks/` |
| Claude Code (local) | `.claude/commands/gsd/` | `~/.claude/hooks/` |
| OpenCode | `.opencode/commands/gsd/` | — |
| Gemini CLI | `.gemini/commands/gsd/` | `.gemini/hooks/` |
| Codex | skills/ directories + config.toml | — |
