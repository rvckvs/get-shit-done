# GSD Architecture — Technical Reference

A complete technical reference for developers who want to understand, contribute to, or debug Get Shit Done (GSD). For user-facing usage and configuration, see the [User Guide](USER-GUIDE.md).

---

## Table of Contents

- [Overview](#overview)
- [Repository Layout](#repository-layout)
- [Installation Pipeline (`bin/install.js`)](#installation-pipeline)
  - [Entry Point and Argument Parsing](#entry-point-and-argument-parsing)
  - [Interactive vs. Non-Interactive Install](#interactive-vs-non-interactive-install)
  - [Target Directories per Runtime](#target-directories-per-runtime)
  - [What Gets Installed](#what-gets-installed)
  - [Runtime-Specific Transformations](#runtime-specific-transformations)
  - [Hook Registration](#hook-registration)
  - [Local Patch Persistence](#local-patch-persistence)
  - [Uninstall Logic](#uninstall-logic)
- [Usage Flow: Command → Workflow → Tools](#usage-flow)
- [CLI Binary: `gsd-tools.cjs`](#cli-binary)
  - [Invocation](#invocation)
  - [Global Flags](#global-flags)
  - [Command Groups](#command-groups)
  - [Output Convention](#output-convention)
- [Library Modules (`lib/*.cjs`)](#library-modules)
  - [core.cjs](#corecjs)
  - [commands.cjs](#commandscjs)
  - [config.cjs](#configcjs)
  - [frontmatter.cjs](#frontmattercjs)
  - [init.cjs](#initcjs)
  - [milestone.cjs](#milestonecjs)
  - [phase.cjs](#phasecjs)
  - [roadmap.cjs](#roadmapcjs)
  - [state.cjs](#statecjs)
  - [template.cjs](#templatecjs)
  - [verify.cjs](#verifycjs)
- [`.planning/` Directory Data Model](#planning-directory-data-model)
- [Agent Orchestration](#agent-orchestration)
  - [Agent Definitions](#agent-definitions)
  - [Model Profile Resolution](#model-profile-resolution)
  - [How Workflows Spawn Agents](#how-workflows-spawn-agents)
- [Hooks System](#hooks-system)
  - [Statusline Hook](#statusline-hook)
  - [Context Monitor Hook](#context-monitor-hook)
- [Cross-Platform and Multi-Runtime Notes](#cross-platform-and-multi-runtime-notes)

---

## Overview

GSD is a **meta-prompting, context engineering, and spec-driven development system**. Its architecture has two distinct layers:

1. **The installer** (`bin/install.js`) — a Node.js script run once via `npx`. It writes prompt files, agent definitions, workflow files, and hook scripts into the user's AI coding runtime configuration directory. After this, GSD has no server, no daemon, and no persistent process.

2. **The runtime** — entirely AI-agent-driven. Once installed, every `/gsd:*` slash command is a Markdown prompt file. The AI agent reads the prompt, follows the workflow, and invokes `gsd-tools.cjs` via shell to perform state operations and file manipulation.

```
Developer runs:    npx get-shit-done-cc@latest
                          │
                          ▼
                   bin/install.js
                          │  writes files to runtime config dir
                          ▼
              ~/.claude/  (or .opencode/, .gemini/, .codex/)
                    ├── commands/gsd/*.md     ← slash command prompts
                    ├── get-shit-done/
                    │   ├── bin/gsd-tools.cjs ← CLI binary
                    │   ├── bin/lib/*.cjs      ← library modules
                    │   ├── workflows/*.md     ← full workflow logic
                    │   ├── templates/         ← document templates
                    │   └── references/        ← internal reference docs
                    ├── agents/gsd-*.md        ← subagent definitions
                    └── hooks/                 ← statusline + context monitor
```

**Key principle:** all "intelligence" lives in Markdown prompt files. `gsd-tools.cjs` is a pure state-manipulation binary — it reads and writes files, computes derived values, and returns JSON. It never makes decisions.

---

## Repository Layout

```
get-shit-done/
├── bin/
│   └── install.js          # npx entry point (runs once at install time)
├── commands/gsd/           # Thin slash command entry prompts (.md)
│   └── *.md                # Each file maps to one /gsd:* command
├── get-shit-done/          # Installed into the runtime config dir
│   ├── bin/
│   │   ├── gsd-tools.cjs   # Multi-command CLI binary (state/config ops)
│   │   └── lib/            # Library modules
│   │       ├── core.cjs    # Config, paths, model profiles, phase/git utils
│   │       ├── commands.cjs# Utility commands (slug, timestamp, todos, etc.)
│   │       ├── config.cjs  # Config read/write
│   │       ├── frontmatter.cjs # YAML frontmatter CRUD
│   │       ├── init.cjs    # Compound init payloads for workflows
│   │       ├── milestone.cjs   # Milestone lifecycle
│   │       ├── phase.cjs   # Phase discovery, CRUD, numbering
│   │       ├── roadmap.cjs # ROADMAP.md parsing
│   │       ├── state.cjs   # STATE.md R/W and progression engine
│   │       ├── template.cjs# Template file rendering
│   │       └── verify.cjs  # Verification suite + health checks
│   ├── workflows/          # Full workflow logic (one per command)
│   ├── templates/          # Document templates (project.md, phase.md, …)
│   └── references/         # Internal reference docs consumed by workflows
├── agents/                 # Agent definition files (gsd-*.md)
├── hooks/
│   ├── gsd-statusline.js   # Source: writes context metrics to /tmp
│   ├── gsd-context-monitor.js # Source: reads metrics, injects warnings
│   ├── gsd-check-update.js # Source: version check at session start
│   └── dist/               # Bundled versions (esbuild output, distributed)
├── scripts/
│   ├── build-hooks.js      # esbuild bundler for hooks/
│   └── run-tests.cjs       # Cross-platform test runner
├── tests/                  # Test suite (*.test.cjs, node:test)
├── docs/                   # User-facing documentation
└── context/                # AI-agent context files (architecture, commands, etc.)
```

---

## Installation Pipeline

### Entry Point and Argument Parsing

`bin/install.js` is the `bin` entry in `package.json`. When run via `npx get-shit-done-cc`, Node.js executes it directly.

Arguments are parsed by hand (no external arg-parser library). Recognized flags:

| Flag | Effect |
|------|--------|
| `--global` / `-g` | Install to runtime config dir (`~/.claude/`, `~/.gemini/`, etc.) |
| `--local` / `-l` | Install to current working directory (`./.claude/`, etc.) |
| `--claude` | Target Claude Code |
| `--opencode` | Target OpenCode |
| `--gemini` | Target Gemini CLI |
| `--codex` | Target Codex |
| `--all` | Target all four runtimes |
| `--uninstall` / `-u` | Remove GSD from specified runtime/location |
| `--config-dir <path>` | Override config directory (useful for Docker/CI) |
| `--force-statusline` | Replace an existing statusline configuration |
| `--help` / `-h` | Print usage |

### Interactive vs. Non-Interactive Install

If neither runtime flag nor location flag is provided, the installer checks `process.stdin.isTTY`:

- **TTY (interactive):** presents two prompts — runtime selection (1–5) and install location (global/local)
- **Non-TTY (CI/Docker/pipe):** defaults to Claude Code, global install, no statusline prompt

### Target Directories per Runtime

| Runtime | Global path | Local path |
|---------|-------------|------------|
| Claude Code | `~/.claude/` (`CLAUDE_CONFIG_DIR` if set) | `./.claude/` |
| OpenCode | `~/.config/opencode/` (XDG: `XDG_CONFIG_HOME/opencode` or `OPENCODE_CONFIG_DIR`) | `./.opencode/` |
| Gemini CLI | `~/.gemini/` (`GEMINI_CONFIG_DIR` if set) | `./.gemini/` |
| Codex | `~/.codex/` (`CODEX_HOME` if set) | `./.codex/` |

`--config-dir` overrides environment variables and takes highest priority.

### What Gets Installed

For every runtime, the installer copies from the npm package source into the target directory. The install function (`install(isGlobal, runtime)`) performs these steps in order:

1. **Back up locally modified files** — calls `saveLocalPatches()` to detect files modified since last install (via SHA256 manifest) and backs them up to `gsd-local-patches/`
2. **Clean up orphaned files** — removes files from previous versions that were renamed or deleted
3. **Commands** — copies entry prompt files (runtime-specific format, see below)
4. **`get-shit-done/`** — copies workflows, templates, references, and `bin/gsd-tools.cjs` + `lib/` with path replacement
5. **Agents** — copies `agents/gsd-*.md` with runtime conversion
6. **`CHANGELOG.md`** — copied into `get-shit-done/CHANGELOG.md`
7. **`VERSION`** — writes current package version
8. **`package.json`** — writes `{"type":"commonjs"}` to force CommonJS mode regardless of project `type: "module"` settings (not for Codex)
9. **Hooks** — copies bundled hook scripts from `hooks/dist/`, templating the config dir path
10. **Settings** — registers hooks in `settings.json` (statusline, update-check, context monitor)
11. **File manifest** — writes `gsd-file-manifest.json` with SHA256 hashes of all installed files

### Runtime-Specific Transformations

All source files are authored in **Claude Code format**. The installer transforms them on the fly for other runtimes:

#### OpenCode
Function: `convertClaudeToOpencodeFrontmatter(content)`

- Renames `allowed-tools:` → `tools:` (object format: `toolname: true`)
- Converts `AskUserQuestion` → `question`, `SlashCommand` → `skill`, `TodoWrite` → `todowrite`
- Replaces `/gsd:command` → `/gsd-command` (OpenCode uses flat `command/` namespace)
- Replaces `~/.claude/` → `~/.config/opencode/`
- Removes `name:` field (OpenCode uses filename for command name)
- Converts color names to hex codes (`cyan` → `#00FFFF`)

Commands are flattened: `commands/gsd/plan-phase.md` → `command/gsd-plan-phase.md`

OpenCode also gets `opencode.json` permission configuration to allow reading the `get-shit-done/` dir without prompts.

#### Gemini CLI
Functions: `convertClaudeToGeminiAgent(content)`, `convertClaudeToGeminiToml(content)`

- Agent files: converts `allowed-tools` to YAML array; maps tool names (`Read` → `read_file`, `Bash` → `run_shell_command`); excludes `mcp__*` tools (auto-discovered) and `Task` (agents auto-registered); removes `color:` field; escapes `${VAR}` → `$VAR` to avoid Gemini template parsing
- Command files: converted to `.toml` format (`description = "..."`, `prompt = "..."`)
- `settings.json` gets `experimental.enableAgents = true` and uses `AfterTool` instead of `PostToolUse` for the context monitor hook

#### Codex
Functions: `convertClaudeCommandToCodexSkill()`, `convertClaudeAgentToCodexAgent()`, `generateCodexAgentToml()`, `generateCodexConfigBlock()`

- Commands become "skills": each `commands/gsd/name.md` is written as `skills/gsd-name/SKILL.md`
- Each skill gets a `<codex_skill_adapter>` header injected explaining how to map Claude-specific primitives (`AskUserQuestion` → `request_user_input`, `Task()` → `spawn_agent`)
- Agent files get a `<codex_agent_role>` header and a companion `agents/gsd-name.toml` config file
- `config.toml` is generated/merged with `[features]` (multi_agent, default_mode_request_user_input) and per-agent `[agents.gsd-*]` entries
- No hooks or `package.json` are installed for Codex

#### Claude Code
No frontmatter transformation is needed. Path references (`~/.claude/`) are already in the correct format. The source files are the canonical format.

### Hook Registration

For Claude Code and Gemini CLI (not OpenCode, not Codex):

**`settings.json`** is updated with three hook registrations:

1. **`statusLine`** — `node <configDir>/hooks/gsd-statusline.js`  
   Writes context metrics to `/tmp/claude-ctx-{session}.json` on every render.

2. **`hooks.SessionStart`** — `node <configDir>/hooks/gsd-check-update.js`  
   Checks the npm registry at session start; prints a message if a new version is available.

3. **`hooks.PostToolUse`** (Claude) / **`hooks.AfterTool`** (Gemini) — `node <configDir>/hooks/gsd-context-monitor.js`  
   Reads the metrics file; injects a WARNING or CRITICAL message into agent context when context window is low.

If a `statusLine` already exists, the installer asks interactively (or skips silently in non-TTY mode) unless `--force-statusline` is set.

Orphaned hook registrations from previous GSD versions are cleaned from `settings.json` on every install.

### Local Patch Persistence

Since v1.17, GSD tracks locally modified files and preserves them through updates:

1. **On install:** `saveLocalPatches(configDir)` reads `gsd-file-manifest.json`, computes SHA256 of every installed GSD file, compares against stored hashes, and backs up any modified file to `gsd-local-patches/` with a `backup-meta.json` manifest.

2. **After install:** `reportLocalPatches()` prints which files were backed up and instructs the user to run `/gsd:reapply-patches` to merge them back.

3. **Manifest write:** After all files are installed, `writeManifest(configDir, runtime)` records the new SHA256 hashes in `gsd-file-manifest.json`.

### Uninstall Logic

`uninstall(isGlobal, runtime)` performs the reverse:

1. Removes the runtime's command files (`commands/gsd/` for Claude/Gemini, `command/gsd-*.md` for OpenCode, `skills/gsd-*/` for Codex)
2. Removes `get-shit-done/` directory
3. Removes `agents/gsd-*.md` files
4. Removes hook JS files (`gsd-statusline.js`, `gsd-context-monitor.js`, etc.)
5. Removes `package.json` (only if it is GSD's minimal `{"type":"commonjs"}`)
6. Cleans `settings.json`: removes statusline, SessionStart hook, PostToolUse/AfterTool hook
7. For OpenCode: removes GSD permission entries from `opencode.json`
8. For Codex: strips GSD sections from `config.toml`, removes `agents/gsd-*.toml`

Non-GSD user content is never touched.

---

## Usage Flow

```
User types:    /gsd:plan-phase 3
                    │
                    ▼
commands/gsd/plan-phase.md          ← thin entry prompt
    (reads the workflow file)
                    │
                    ▼
get-shit-done/workflows/plan-phase.md    ← full workflow logic
    Step 1: call gsd-tools.cjs init plan-phase 3
                    │
                    ▼
gsd-tools.cjs → init.cjs → cmdInitPlanPhase()
    Returns JSON: executor_model, phase_dir, config flags,
                  roadmap phases, phase info, milestone version
                    │
                    ▼
    Step 2: spawn gsd-phase-researcher (×4 parallel)
        Stack researcher, Features researcher,
        Architecture researcher, Pitfalls researcher
            → each writes into RESEARCH.md
                    │
                    ▼
    Step 3: spawn gsd-planner
        Reads: PROJECT.md, REQUIREMENTS.md, RESEARCH.md, CONTEXT.md
        Writes: 0N-01-PLAN.md, 0N-02-PLAN.md, ...
                    │
                    ▼
    Step 4: spawn gsd-plan-checker (up to 3 iterations)
        Checks 8 dimensions including Nyquist coverage
        PASS → done
        FAIL → loops back to gsd-planner
```

**Every command follows this same pattern:**

1. The slash command file (`commands/gsd/*.md`) is a thin wrapper that reads the corresponding workflow file.
2. The workflow file (`get-shit-done/workflows/*.md`) contains the full step-by-step logic in XML-like tags.
3. The workflow calls `gsd-tools.cjs` via `Bash` tool invocations to read state, locate files, and write mutations.
4. The workflow spawns named subagents (via `Task()` in Claude Code, `spawn_agent()` in Codex) for heavy lifting.

---

## CLI Binary

### Invocation

```bash
node get-shit-done/bin/gsd-tools.cjs <command> [subcommand] [args...] [--raw] [--cwd <path>]
```

### Global Flags

| Flag | Effect |
|------|--------|
| `--raw` | Output raw value (string/number) instead of JSON for commands that support it |
| `--cwd <path>` | Override the working directory (supports both `--cwd /path` and `--cwd=/path`). Used when subagents run in a different directory. |

### Command Groups

| Command | Subcommands | Module | Purpose |
|---------|-------------|--------|---------|
| `state` | `load`, `json`, `update`, `get`, `patch`, `advance-plan`, `record-metric`, `update-progress`, `add-decision`, `add-blocker`, `resolve-blocker`, `record-session` | `state.cjs` | Read/write STATE.md fields; track decisions, blockers, metrics |
| `resolve-model` | — | `commands.cjs` | Look up the Claude model name for an agent given the current profile |
| `find-phase` | — | `phase.cjs` | Locate a phase directory by number (searches current phases, then milestone archives) |
| `commit` | — | `commands.cjs` | Git add + commit with optional file list; respects `commit_docs` config |
| `verify-summary` | — | `verify.cjs` | Spot-check a SUMMARY.md: files exist, commits valid, self-check section present |
| `template` | `select`, `fill` | `template.cjs` | Select appropriate summary variant; create pre-filled plan/summary/verification files |
| `frontmatter` | `get`, `set`, `merge`, `validate` | `frontmatter.cjs` | YAML frontmatter CRUD on any `.md` file |
| `verify` | `plan-structure`, `phase-completeness`, `references`, `commits`, `artifacts`, `key-links` | `verify.cjs` | Verification suite for plans, phases, refs, commits, must-haves |
| `generate-slug` | — | `commands.cjs` | Convert text to lowercase hyphenated URL slug |
| `current-timestamp` | `full`, `date`, `filename` | `commands.cjs` | Return ISO timestamp in various formats |
| `list-todos` | — | `commands.cjs` | Count and list pending todo files from `.planning/todos/pending/` |
| `verify-path-exists` | — | `commands.cjs` | Return boolean for file/directory existence |
| `config-ensure-section` | — | `config.cjs` | Initialize or ensure `.planning/config.json` exists |
| `config-get` | — | `config.cjs` | Read a config key |
| `config-set` | — | `config.cjs` | Write a config key |
| `history-digest` | — | `commands.cjs` | Aggregate all SUMMARY.md files into a single history object |
| `phases` | `list` | `phase.cjs` | List phase directories or files of a given type |
| `roadmap` | `get-phase`, `analyze`, `update-plan-progress` | `roadmap.cjs` | Parse ROADMAP.md: extract phase sections, full analysis, update progress tables |
| `requirements` | `mark-complete` | `milestone.cjs` | Mark requirement IDs as complete in REQUIREMENTS.md |
| `phase` | `next-decimal`, `add`, `insert`, `remove`, `complete` | `phase.cjs` | Phase lifecycle: compute decimal numbers, create/renumber/delete phase dirs |
| `milestone` | `complete` | `milestone.cjs` | Archive milestone, write MILESTONES.md, optionally move phase dirs |
| `validate` | `consistency`, `health` | `verify.cjs` | Audit phase numbering consistency and .planning/ structure integrity |
| `progress` | `json`, `table`, `bar` | `commands.cjs` | Render project progress in various formats |
| `todo` | `complete` | `commands.cjs` | Move a todo file from pending/ to done/ |
| `scaffold` | `context`, `uat`, `verification`, `phase-dir` | `commands.cjs` | Create template files for a phase (CONTEXT.md, UAT.md, etc.) |
| `init` | `execute-phase`, `plan-phase`, `new-project`, `new-milestone`, `quick`, `resume`, `verify-work`, `phase-op`, `todos`, `milestone-op`, `map-codebase`, `progress` | `init.cjs` | Compound bootstrap: return all context needed to start a workflow in a single JSON call |
| `phase-plan-index` | — | `phase.cjs` | Index all plans in a phase with wave assignments and completion status |
| `state-snapshot` | — | `state.cjs` | Structured parse of STATE.md into a typed object |
| `summary-extract` | — | `commands.cjs` | Extract structured fields from a SUMMARY.md file |
| `websearch` | — | `commands.cjs` | Web search via Brave API (requires `BRAVE_API_KEY` env var) |

### Output Convention

All commands output to **stdout**. All errors go to **stderr** with a non-zero exit code.

- Default: pretty-printed JSON (`JSON.stringify(result, null, 2)`)
- `--raw`: raw string/number for commands that support it (avoids JSON parsing overhead in shell)
- Large payloads (>50 KB): written to a temp file and returned as `@file:/tmp/gsd-*.json`. Callers check for the `@file:` prefix and read the file path.

This pattern prevents exceeding Claude Code's Bash tool output buffer (~50 KB).

---

## Library Modules

### `core.cjs`

The foundation module. Imported by every other module.

**Exports:**

- `MODEL_PROFILES` — object mapping agent name → `{quality, balanced, budget}` model tier names (`'opus'`, `'sonnet'`, `'haiku'`). `'opus'` is remapped to `'inherit'` in the return value (tells Claude to use its current/default model rather than hard-coding a name that changes with releases).

- `loadConfig(cwd)` — reads `.planning/config.json`, applies defaults, normalizes nested config keys (e.g. `workflow.research` → `research`), and migrates the deprecated `depth` key to `granularity`. Returns a flat object.

- `output(result, raw, rawValue)` — writes result to stdout. Handles the 50 KB threshold → `@file:` pattern. Always calls `process.exit(0)`.

- `error(message)` — writes to stderr, exits with code 1.

- `execGit(cwd, args)` — safe git wrapper. Returns `{exitCode, stdout, stderr}`. Arguments with special characters are shell-quoted.

- `isGitIgnored(cwd, targetPath)` — uses `git check-ignore --no-index` to test gitignore rules even for tracked files.

- `findPhaseInternal(cwd, phase)` — locates a phase directory by number. Searches `.planning/phases/` first, then `.planning/milestones/v*-phases/` (newest milestone first). Returns a rich object with plans, summaries, slugs, and file inventory.

- `normalizePhaseName(phase)` — pads phase number to 2 digits (`3` → `03`); handles letter suffixes and decimal extensions (`12A.1`).

- `comparePhaseNum(a, b)` — sort comparator for phase numbers. Handles integers, letter suffixes, and multi-level decimals (e.g., `12A.1.2`).

- `resolveModelInternal(cwd, agentType)` — looks up model for an agent. First checks `config.model_overrides[agentType]`, then falls back to `MODEL_PROFILES[agentType][profile]`.

- `getMilestoneInfo(cwd)` — parses ROADMAP.md for the current milestone version and name. Handles both list-format (`🚧 **v2.1 Name**`) and heading-format (`## ... v1.0: Name`) roadmaps.

- `toPosixPath(p)` — converts OS path separators to forward slashes for user-visible output.

### `commands.cjs`

Standalone utility commands that don't belong to a specific domain module.

Key functions:
- `cmdResolveModel(cwd, agentType, raw)` — wraps `resolveModelInternal`
- `cmdCommit(cwd, message, files, raw, amend)` — commits `.planning/` changes via git; respects `commit_docs` config; skips if nothing to commit or if `.planning/` is gitignored
- `cmdProgressRender(cwd, format, raw)` — renders project progress (phases complete/total, plans complete/total) in JSON, ASCII table, or progress bar format
- `cmdScaffold(cwd, type, options, raw)` — creates template files (CONTEXT.md, UAT.md, VERIFICATION.md, phase dir) from templates/
- `cmdHistoryDigest(cwd, raw)` — walks all SUMMARY.md files in `.planning/phases/` and aggregates them into a single history payload
- `cmdWebsearch(query, options, raw)` — calls the Brave Search API if `BRAVE_API_KEY` is set in the environment

### `config.cjs`

Config file management for `.planning/config.json`.

- `cmdConfigEnsureSection(cwd, raw)` — creates `.planning/config.json` with defaults if it does not exist
- `cmdConfigGet(cwd, key, raw)` — reads a dot-notation key from config (e.g., `workflow.research`)
- `cmdConfigSet(cwd, key, value, raw)` — writes a dot-notation key; auto-coerces `"true"`/`"false"` strings to booleans

### `frontmatter.cjs`

YAML frontmatter operations for any Markdown file. GSD uses frontmatter (between `---` delimiters) to store structured metadata in plan files, summary files, etc.

- `extractFrontmatter(content)` — parses frontmatter into a plain object; supports string, number, boolean, and array values
- `reconstructFrontmatter(fields)` — serializes an object back to YAML frontmatter string
- `cmdFrontmatterGet(cwd, file, field, raw)` — extract all frontmatter or a specific field
- `cmdFrontmatterSet(cwd, file, field, value, raw)` — update or add a single field
- `cmdFrontmatterMerge(cwd, file, data, raw)` — merge a JSON object into existing frontmatter
- `cmdFrontmatterValidate(cwd, file, schema, raw)` — validate required fields for a schema (`plan`, `summary`, `verification`)
- `parseMustHavesBlock(content)` — parses the `must_haves` YAML block used in plan files (artifacts, key_links)

### `init.cjs`

Compound init commands. Each `init <workflow>` call is a single Bash tool invocation that returns all context a workflow needs at startup — eliminating 5–10 individual tool calls.

Pattern: each `cmdInit*` function:
1. Calls `loadConfig(cwd)` for feature flags
2. Calls `resolveModelInternal()` for each relevant agent
3. Calls `findPhaseInternal()` or `getRoadmapPhaseInternal()` for phase context
4. Calls `getMilestoneInfo()` for milestone version/name
5. Checks file existence for STATE.md, ROADMAP.md, config.json
6. Returns a single flat JSON payload

Available init commands: `execute-phase`, `plan-phase`, `new-project`, `new-milestone`, `quick`, `resume`, `verify-work`, `phase-op`, `todos`, `milestone-op`, `map-codebase`, `progress`.

### `milestone.cjs`

Milestone lifecycle operations.

- `cmdMilestoneComplete(cwd, version, options, raw)` — archives the current milestone: creates or appends to `MILESTONES.md`, optionally moves all phase directories into `.planning/milestones/v{version}-phases/`, writes a `milestone-archive.md` summary
- `cmdRequirementsMarkComplete(cwd, args, raw)` — marks one or more requirement IDs as complete in REQUIREMENTS.md; accepts multiple formats: `REQ-01,REQ-02`, `REQ-01 REQ-02`, or `[REQ-01, REQ-02]`

### `phase.cjs`

Phase directory management. Phases are numbered directories under `.planning/phases/` (e.g., `03-user-auth`).

- `cmdFindPhase(cwd, phase, raw)` — wraps `findPhaseInternal`; searches current phases and milestone archives
- `cmdPhasesList(cwd, options, raw)` — list phase directories, optionally filtered by type (plans, summaries, etc.)
- `cmdPhaseNextDecimal(cwd, phase, raw)` — compute the next decimal phase number after the given phase (e.g., `3` → `3.1`, `3.1` → `3.2`)
- `cmdPhaseAdd(cwd, description, raw)` — append a new phase to ROADMAP.md and create its directory
- `cmdPhaseInsert(cwd, afterPhase, description, raw)` — insert a decimal-numbered phase after `afterPhase` (does not renumber existing phases)
- `cmdPhaseRemove(cwd, phase, options, raw)` — remove a phase directory and renumber all subsequent phases in ROADMAP.md and on disk
- `cmdPhaseComplete(cwd, phase, raw)` — mark a phase as `[x]` in ROADMAP.md and update STATE.md
- `cmdPhasePlanIndex(cwd, phase, raw)` — return all plans in a phase with their wave numbers and completion status (used by execute-phase workflow to determine execution order)

**Phase numbering:** phases use zero-padded integers (`01`, `02`) optionally followed by a letter (`12A`) or decimal extension (`3.1`, `12A.1.2`). `comparePhaseNum` provides a full ordering across these formats. Decimal phases are used by `insert-phase` to inject urgent work without renumbering.

### `roadmap.cjs`

ROADMAP.md parsing.

- `cmdRoadmapGetPhase(cwd, phase, raw)` — extract a single phase section (name, goal, requirements list)
- `cmdRoadmapAnalyze(cwd, raw)` — full roadmap parse: all phases with status, plan/summary counts from disk, milestone info
- `cmdRoadmapUpdatePlanProgress(cwd, phase, raw)` — update the plan progress row in a phase's roadmap table (PLAN count vs SUMMARY count)

### `state.cjs`

STATE.md read/write. STATE.md is the "session memory" file — it persists decisions, blockers, the active phase/plan, and execution metrics across Claude sessions.

The file uses Markdown with both bold field format (`**Field:** value`) and plain format (`Field: value`). The parser handles both.

Key functions:
- `cmdStateLoad(cwd, raw)` — return full state: config, raw STATE.md content, file existence flags
- `cmdStateJson(cwd, raw)` — parse STATE.md frontmatter into JSON
- `cmdStateGet(cwd, section, raw)` — get full STATE.md or a specific section/field
- `cmdStatePatch(cwd, patches, raw)` — batch-update multiple STATE.md fields
- `cmdStateAdvancePlan(cwd, raw)` — increment the current plan counter in STATE.md
- `cmdStateRecordMetric(cwd, opts, raw)` — append execution metrics (duration, task count, file count) to STATE.md
- `cmdStateAddDecision(cwd, opts, raw)` — append a decision entry to the Decisions section
- `cmdStateAddBlocker(cwd, opts, raw)` — add a blocker entry
- `cmdStateResolveBlocker(cwd, text, raw)` — remove a blocker entry by text match
- `cmdStateRecordSession(cwd, opts, raw)` — update session continuity fields (stopped_at, resume_file)
- `cmdStateSnapshot(cwd, raw)` — structured parse of STATE.md into typed fields (active_phase, active_plan, decisions array, blockers array, metrics)

### `template.cjs`

Template file creation for plan documents.

- `cmdTemplateSelect(cwd, templateType, raw)` — choose summary template variant based on phase complexity (minimal, standard, complex)
- `cmdTemplateFill(cwd, type, options, raw)` — create a pre-populated file from a template:
  - `summary` — fills in phase/plan number, name, wave, timestamp
  - `plan` — fills in phase/plan number, type (execute/tdd), wave number
  - `verification` — fills in phase number, timestamp

Templates live in `get-shit-done/templates/` and contain `{{PLACEHOLDER}}` tokens.

### `verify.cjs`

The verification suite. GSD has two types of verification:

**Execution verification** (used after each plan runs):
- `cmdVerifySummary(cwd, path, checkCount, raw)` — spot-check a SUMMARY.md: file exists, mentioned files exist on disk, at least one commit hash is valid, self-check section is present
- `cmdVerifyPlanStructure(cwd, file, raw)` — validate a PLAN.md has required XML sections (`<task>`, `<action>`, `<verify>`, `<done>`)
- `cmdVerifyPhaseCompleteness(cwd, phase, raw)` — check all plans in a phase have corresponding summaries
- `cmdVerifyReferences(cwd, file, raw)` — resolve all `@file:` references and path mentions in a file
- `cmdVerifyCommits(cwd, hashes, raw)` — batch-verify commit hashes via `git cat-file -t`
- `cmdVerifyArtifacts(cwd, planFile, raw)` — check `must_haves.artifacts` entries (file exists, line count, pattern match, export exists)
- `cmdVerifyKeyLinks(cwd, planFile, raw)` — check `must_haves.key_links` entries (pattern found in source or target file)

**Health validation** (used by `/gsd:health`):
- `cmdValidateConsistency(cwd, raw)` — check phase numbering: no gaps, no duplicates, disk dirs match ROADMAP.md
- `cmdValidateHealth(cwd, options, raw)` — comprehensive `.planning/` integrity check; with `--repair`, auto-creates missing required files

---

## `.planning/` Directory Data Model

GSD creates and manages this directory in the user's project root:

```
.planning/
├── config.json             ← GSD config (model profile, feature flags, git strategy)
├── PROJECT.md              ← Living project description (always loaded by agents)
├── REQUIREMENTS.md         ← Scoped v1/v2 requirements with REQ-NN IDs
├── ROADMAP.md              ← Phase breakdown with progress tracking
├── STATE.md                ← Session memory: decisions, blockers, current position
├── MILESTONES.md           ← Archive of completed milestones
├── research/               ← Domain research output from /gsd:new-project
│   ├── SUMMARY.md
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── STACK.md
│   └── PITFALLS.md
├── todos/
│   ├── pending/            ← Active todo files
│   └── done/               ← Completed todo files
├── debug/
│   ├── {session}/          ← Active debug sessions
│   └── resolved/           ← Archived debug sessions
├── codebase/               ← Brownfield analysis from /gsd:map-codebase
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── STACK.md
│   ├── CONCERNS.md
│   ├── INTEGRATIONS.md
│   ├── STRUCTURE.md
│   └── TESTING.md
├── quick/                  ← Ad-hoc tasks from /gsd:quick
│   └── {N}-{slug}/
│       ├── PLAN.md
│       └── SUMMARY.md
└── phases/
    └── {NN}-{phase-name}/
        ├── {NN}-CONTEXT.md     ← Implementation decisions (from /gsd:discuss-phase)
        ├── {NN}-RESEARCH.md    ← Domain research (from /gsd:plan-phase)
        ├── {NN}-VALIDATION.md  ← Nyquist test coverage map
        ├── {NN}-{MM}-PLAN.md   ← Atomic execution plan (XML-structured tasks)
        ├── {NN}-{MM}-SUMMARY.md← Post-execution outcome
        └── {NN}-VERIFICATION.md← Post-execution phase-level verification
```

**Key files explained:**

`config.json` — flat or nested JSON. `loadConfig()` normalizes nested keys (e.g., `workflow.research` ↔ `research`) so both formats work. Supports `model_overrides` for per-agent model assignment.

`STATE.md` — the agent's memory between sessions. Contains: current phase/plan, active milestone, recent decisions (with rationale), active blockers, session handoff context, and execution metrics (duration, task count, files changed per plan).

`PLAN.md` files — XML-structured tasks:
```xml
---
phase: "03"
plan: "01"
wave: 1
status: pending
must_haves:
  artifacts:
    - path: src/auth/login.ts
      min_lines: 50
      contains: "export function login"
  key_links:
    - source: src/auth/login.ts
      target: src/app/api/auth/route.ts
      pattern: "import.*login"
---

<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>Implementation details</action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

`SUMMARY.md` files — post-execution records with commit hashes, files changed, and a self-check section. `verify-summary` validates these after each plan.

---

## Agent Orchestration

### Agent Definitions

Named agents are defined as Markdown files in `agents/gsd-*.md`. Each file contains YAML frontmatter and a body:

```yaml
---
name: gsd-planner
description: Creates atomic, verifiable execution plans for a phase
color: cyan
tools: Read, Write, Bash, Glob, Grep, Task
---
```

The body is the system prompt / task instructions for that agent.

During install, these files are transformed per-runtime (tool name conversion for OpenCode/Gemini, `<codex_agent_role>` header for Codex, `.toml` config files for Codex).

### Model Profile Resolution

`resolveModelInternal(cwd, agentType)` is the single source of truth for model selection:

1. Check `config.model_overrides[agentType]` — if set, use that model directly
2. Look up `MODEL_PROFILES[agentType][profile]` where `profile` = `config.model_profile` (`quality`, `balanced`, or `budget`)
3. If the result is `'opus'`, return `'inherit'` instead — this tells Claude to use its current default model (the concept of "opus" is version-independent and changes over time)
4. Fall back to `'sonnet'` if the agent type is not in `MODEL_PROFILES`

Full profile table (as defined in `core.cjs`):

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| gsd-planner | opus | opus | sonnet |
| gsd-roadmapper | opus | sonnet | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
| gsd-codebase-mapper | sonnet | haiku | haiku |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-integration-checker | sonnet | sonnet | haiku |
| gsd-nyquist-auditor | sonnet | sonnet | haiku |

### How Workflows Spawn Agents

In Claude Code, workflows call the `Task()` primitive:

```
Task(
  subagent_type="gsd-planner",
  description="Plan phase 3",
  prompt=<full task prompt with file contents inlined>
)
```

The agent receives: its own system prompt (from `agents/gsd-planner.md`) + the task prompt from the workflow. It has a **fresh 200K context window** — none of the parent session's accumulated context. This is the core mechanism that prevents context rot.

Parallel execution: workflows spawn multiple agents simultaneously (e.g., 4 phase researchers in parallel), then wait for all to complete before proceeding.

In OpenCode, the equivalent is also `Task()`. In Codex, it is `spawn_agent()` + `wait()`. The `<codex_skill_adapter>` header in Codex skill files documents this mapping.

---

## Hooks System

### Statusline Hook

**Source:** `hooks/gsd-statusline.js`  
**Installed to:** `<configDir>/hooks/gsd-statusline.js` (bundled via esbuild)  
**Registered as:** `statusLine` in `settings.json`

Triggered by the AI runtime on every render cycle. Reads:
- Current model name from Claude's runtime context
- Active todo (if any) from `.planning/todos/pending/`
- Context window usage from the runtime environment

Writes a JSON bridge file: `/tmp/claude-ctx-{session_id}.json`

```json
{
  "session_id": "abc123",
  "remaining_percentage": 42.0,
  "used_pct": 58,
  "timestamp": 1708200000
}
```

Also formats a statusline string displayed in the Claude Code terminal bar.

### Context Monitor Hook

**Source:** `hooks/gsd-context-monitor.js`  
**Installed to:** `<configDir>/hooks/gsd-context-monitor.js` (bundled via esbuild)  
**Registered as:** `PostToolUse` (Claude) or `AfterTool` (Gemini) in `settings.json`

Triggered after every tool call. Reads the bridge file from the statusline hook. If remaining context falls below thresholds, injects a warning into `additionalContext` which the agent sees in its conversation:

| Level | Remaining | Injected message |
|-------|-----------|-----------------|
| Normal | > 35% | (nothing) |
| WARNING | ≤ 35% | Wrap up current task, avoid starting new complex work |
| CRITICAL | ≤ 25% | Stop immediately, save state with `/gsd:pause-work` |

**Debounce:** first warning fires immediately; subsequent same-level warnings require 5 tool uses between them; severity escalation bypasses debounce.

**Resilience:** everything is wrapped in try/catch; a failing hook never blocks tool execution; stale metrics (>60s old) are ignored.

### Update Check Hook

**Source:** `hooks/gsd-check-update.js`  
**Registered as:** `SessionStart` hook in `settings.json`

Fires once per session. Fetches the latest version from the npm registry and prints a message if the installed version is behind.

---

## Cross-Platform and Multi-Runtime Notes

- **All user-visible paths** use forward slashes via `toPosixPath()` even on Windows
- **`path.join()`** is used for all internal file operations; backslash paths work on Windows
- **Shell snippets** in workflow files use `printf` instead of `echo` to avoid jq parsing issues with special characters
- **No heredoc syntax** in workflow files — file writes use the AI agent's native file-write tool
- **`package.json` CommonJS marker** (`{"type":"commonjs"}`) is written to `<configDir>/package.json` to prevent Node.js ESM resolution from breaking `require()` calls in `gsd-tools.cjs` when a user's project has `"type":"module"` in its own `package.json`
- **Path references** in source files use `~/.claude/` as the canonical form; the installer replaces these with the appropriate path for each runtime during installation
- **`--cwd` flag** on `gsd-tools.cjs` allows subagents running outside the project root to specify the project directory explicitly, which is needed in some sandboxed execution environments
