# GitHub Copilot Instructions

You are working on **Get Shit Done (GSD)** — a meta-prompting, context engineering, and spec-driven development system for AI coding agents (Claude Code, OpenCode, Gemini CLI, Codex).

## Project Context

Read **all files** in the `context/` directory before starting any work. The directory is organic — new files are added over time as decisions, research, plans, and instructions are captured. Do not assume a fixed set of files exists; always list and read the full directory contents.

When you gain new knowledge — decisions made, plans formed, research completed, patterns discovered — **add it to `context/`** as a new file or append it to an existing relevant file. Keep entries concise and factual. This keeps the context self-feeding and useful across sessions.

## Key Rules

### Code Style
- **No external runtime dependencies** — use Node.js built-ins only
- **CommonJS only** — `.cjs` extension, `require()` / `module.exports`
- **No classes, no DI, no enterprise patterns** — functions and plain objects
- **Cross-platform paths** — always `path.join()` for file ops, `toPosixPath()` for user-visible output
- **Error output** — errors go to stderr, non-zero exit. Never swallow errors silently

### Workflow Markdown (workflows/*.md)
- Use `printf` instead of `echo` in shell snippets (avoids jq parse issues)
- Never use heredoc syntax for file writing — use the agent's file-write tool
- Structure with `<purpose>`, `<process>`, `<step name="...">` XML-like tags

### Tests
- Use `node:test` + `assert` — no external test frameworks
- Temp directories created in `beforeEach`, cleaned in `afterEach`
- Run with `npm test` or `npm run test:coverage`

### Changelog
- Every user-facing change gets a `CHANGELOG.md` entry under `## [Unreleased]`

## Architecture in Brief

```
bin/install.js              ← npx entry point (interactive installer)
commands/gsd/*.md           ← Thin slash command entry prompts
get-shit-done/workflows/*.md ← Full workflow logic
get-shit-done/bin/gsd-tools.cjs ← CLI binary called by workflows
get-shit-done/bin/lib/*.cjs ← Library modules (core, config, state, phase…)
agents/                     ← Subagent definitions
hooks/dist/                 ← Bundled runtime hooks (statusline, context monitor)
tests/                      ← Test suite (*.test.cjs)
```

`gsd-tools.cjs` is the single CLI binary. All commands output JSON to stdout. Payloads >50 KB are written to a temp file and returned as `@file:/tmp/gsd-*.json`.

## What NOT to Do

- Don't add npm runtime dependencies — check `package.json` first
- Don't use ESM (`import`/`export`) — the codebase is CommonJS
- Don't break cross-platform compatibility (Windows uses backslash paths)
- Don't remove or weaken existing tests
- Don't add enterprise abstractions (sprint ceremonies, story points, class hierarchies)
