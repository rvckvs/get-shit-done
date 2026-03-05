# Development Guidelines

## Code Style

- **No external runtime dependencies** — use Node.js built-ins only. Check `package.json` before adding anything.
- **CommonJS throughout** — all library files use `.cjs` extension and `require()` / `module.exports`.
- **Minimal comments** — prefer self-documenting names. Add a comment only when the *why* is non-obvious.
- **No enterprise patterns** — no classes, no DI containers, no abstract factories. Functions and plain objects.
- **Error handling** — `gsd-tools.cjs` outputs errors to stderr and exits non-zero. Never swallow errors silently in library code.
- **Cross-platform** — always use `path.join()` for file paths; use `toPosixPath()` when producing user-visible output.

## File Naming

| Location | Convention |
|----------|-----------|
| `lib/*.cjs` | lowercase, hyphenated, `.cjs` extension |
| `tests/*.test.cjs` | matches the module name it tests |
| `workflows/*.md` | lowercase, hyphenated |
| `commands/gsd/*.md` | lowercase, hyphenated |
| `agents/*.agent.md` | `gsd-{role}.agent.md` |

## Adding a New Command

1. Create `commands/gsd/{name}.md` — thin entry prompt that loads the workflow.
2. Create `get-shit-done/workflows/{name}.md` — full workflow logic.
3. If the command needs a new `gsd-tools.cjs` subcommand:
   - Add the handler to `commands.cjs` dispatch table.
   - Implement logic in the appropriate `lib/*.cjs` module.
   - Add tests in `tests/{module}.test.cjs`.
4. Update `docs/USER-GUIDE.md` if the command is user-facing.
5. Add a `CHANGELOG.md` entry under `[Unreleased]`.

## Adding a New `gsd-tools.cjs` Subcommand

1. Edit `get-shit-done/bin/lib/commands.cjs` — add entry to the dispatch table with argument validation.
2. Implement the handler in the relevant module (or create a new one in `lib/`).
3. If creating a new module, export it from `commands.cjs`.
4. Write tests in `tests/` following the existing pattern (`node:test` + `assert`).
5. Ensure output is JSON via `output()` helper from `core.cjs`.

## Testing

```bash
npm test                # Run all tests
npm run test:coverage   # Run with c8 coverage (70% line threshold)
```

Tests live in `tests/` and follow the `node:test` API:

```js
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
```

Each test file:
- Creates a temp directory in `beforeEach` (`fs.mkdtempSync`)
- Restores `process.cwd()` in `afterEach`
- Cleans up temp directories in `afterEach`

The test runner is `scripts/run-tests.cjs` — a custom cross-platform runner.

## Building Hooks

```bash
npm run build:hooks
```

This runs `scripts/build-hooks.js` which uses esbuild to bundle `hooks/` source files into `hooks/dist/`. Hooks must be bundled before publishing. The `prepublishOnly` script runs this automatically.

## Workflow Markdown Style

Workflow files in `get-shit-done/workflows/` use XML-like tags to structure agent instructions:

- `<purpose>` — one-line description of the workflow
- `<core_principle>` — the guiding rule for the workflow
- `<required_reading>` — files the agent must read before starting
- `<process>` — step-by-step instructions in `<step name="...">` tags
- `<step priority="first">` — executed before anything else

**Shell snippets** must use `printf` instead of `echo` (avoids jq parse issues with special characters on some platforms).

**Anti-heredoc rule**: All file-writing in workflow/agent code must use standard file-write tool calls, never heredoc bash syntax.

## Changelog

All user-facing changes must have a `CHANGELOG.md` entry under `## [Unreleased]` before merging.

Format:
```markdown
### Added
- Short description of new feature

### Changed
- Short description of changed behavior

### Fixed
- Short description of bug fix
```

## Versioning

Follows semver. Version lives in `package.json`. Bump before release.

## CI

GitHub Actions runs the test matrix on push/PR:
- Node.js 18, 20, 22
- macOS, Windows, Linux
- Coverage enforced at 70% line threshold

Workflow file: `.github/workflows/test.yml`
