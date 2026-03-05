# GSD Research Report: Improvement & Customization Analysis

> Generated: 2026-03-05 | Version: 1.22.4

## Executive Summary

This report documents a systematic analysis of the GSD codebase, covering test coverage gaps, code quality, workflow completeness, and customization opportunities. The primary finding was a critical coverage gap in `template.cjs` (5.4%). This was remedied by adding 27 new tests, bringing that module to 100% line coverage and raising the project-wide line coverage from 89.92% to 93.82%.

---

## 1. Test Coverage Analysis

### Before (v1.22.4 baseline)

| File            | % Lines | Status  |
|-----------------|---------|---------|
| commands.cjs    | 89.59%  | ✅ Good |
| config.cjs      | 86.98%  | ✅ Good |
| core.cjs        | 90.24%  | ✅ Good |
| frontmatter.cjs | 92.64%  | ✅ Good |
| init.cjs        | 98.59%  | ✅ Good |
| milestone.cjs   | 94.60%  | ✅ Good |
| phase.cjs       | 90.67%  | ✅ Good |
| roadmap.cjs     | 99.32%  | ✅ Good |
| state.cjs       | 94.03%  | ✅ Good |
| **template.cjs**| **5.40%**| ❌ Critical gap |
| verify.cjs      | 95.73%  | ✅ Good |
| **Total**       | **89.92%** |      |

### After (this PR)

| File            | % Lines | Δ       |
|-----------------|---------|---------|
| template.cjs    | 100.00% | +94.6pp |
| **Total**       | **93.82%** | +3.9pp |

### Root Cause

`template.cjs` exports `cmdTemplateSelect` and `cmdTemplateFill`, which are called by the `template select` and `template fill` subcommands in `gsd-tools.cjs`. No test file existed for this module — likely an oversight when the module was extracted from inline workflow logic. The module's functionality is non-trivial: it implements template-selection heuristics (minimal/standard/complex) and generates three types of pre-filled document templates (summary, plan, verification).

### Remaining Uncovered Lines (non-critical)

These are primarily error-path branches that are hard to trigger in automated tests:

- `commands.cjs` 378-379, 452-453, 487-488, 510-511, 522 — error branches in websearch, todo-complete, scaffold
- `config.cjs` 80-81, 104-105 — `fs.mkdirSync` / `writeFileSync` failure paths
- `init.cjs` 12-13, 57-58, 61-62, 85-86, 337-338 — missing-arg guards and error paths
- `roadmap.cjs` 89-90 — `checklist_error` malformed-roadmap branch in `cmdRoadmapGetPhase`

---

## 2. Architecture Observations

### Strengths

- **Zero external runtime dependencies** — entire system runs on Node.js built-ins. No supply-chain risk.
- **Single CLI binary pattern** — `gsd-tools.cjs` dispatches to focused module-level functions. Easy to audit and test in isolation.
- **Consistent output contract** — every command outputs JSON to stdout; errors go to stderr with non-zero exit. Workflows can always `JSON.parse()` safely.
- **Large-payload protection** — the `@file:` protocol for >50 KB payloads prevents Claude's Bash tool buffer from overflowing.
- **Cross-platform design** — `toPosixPath()` and `path.join()` discipline is consistent across all modules.
- **Graceful migration** — `depth` → `granularity` key rename in `loadConfig` and `cmdConfigEnsureSection` is transparent to users.

### Areas Worth Monitoring

| Area | Detail |
|------|--------|
| `isGitIgnored` shell injection guard | Uses a character allowlist regex (`/[^a-zA-Z0-9._\-/]/g`) before passing the path to `git check-ignore`. The current allowlist is conservative and correct, but worth auditing if path formats expand. |
| `cmdWebsearch` fetch call | Uses Node.js global `fetch` (available ≥18). The `engines` field in `package.json` specifies `>=16.7.0`. On Node 16, `fetch` is behind `--experimental-fetch`. Consider adding a runtime guard or bumping minimum Node to 18. |
| `cmdTemplateFill` frontmatter serialization | Uses `reconstructFrontmatter()` from `frontmatter.cjs`. This is a home-grown YAML serializer. Works well for the known data shapes but could produce unexpected output for deeply nested structures. |

---

## 3. Customization Opportunities

### 3.1 User-level Global Defaults

`~/.gsd/defaults.json` already supports overriding `model_profile`, `commit_docs`, and workflow flags. This is documented in `config.cjs` but not surfaced in the user guide. Adding a section to `docs/USER-GUIDE.md` about this file would reduce friction for power users.

### 3.2 Per-agent Model Overrides

`config.json` supports `model_overrides: { "gsd-executor": "sonnet" }`. This lets users pin individual agents to specific models regardless of the global profile. Not documented in the README.

### 3.3 Custom Branch Templates

`phase_branch_template` and `milestone_branch_template` support `{phase}`, `{slug}`, `{milestone}` placeholders. Users with non-standard branch naming conventions can customize these. Worth a short mention in the user guide.

### 3.4 Granularity Setting

The `granularity` config key (`coarse` / `standard` / `fine`) controls how many phases the roadmapper generates. This is a high-leverage setting for projects of different sizes — mention it prominently in setup documentation.

---

## 4. Workflow Completeness

### Commands vs. Workflows

| Command file | Workflow file | Status |
|---|---|---|
| commands/gsd/new-project.md | workflows/new-project.md | ✅ |
| commands/gsd/plan-phase.md | workflows/plan-phase.md | ✅ |
| commands/gsd/execute-phase.md | workflows/execute-phase.md | ✅ |
| commands/gsd/verify-work.md | workflows/verify-work.md | ✅ |
| commands/gsd/debug.md | workflows/diagnose-issues.md | ✅ (name mismatch is intentional) |
| commands/gsd/reapply-patches.md | — | ⚠️ No matching workflow file |
| commands/gsd/join-discord.md | — | ℹ️ Intentionally simple (no workflow needed) |

**`reapply-patches.md`** references no workflow file. This may be intentional (inline logic only), but worth verifying.

---

## 5. Node.js Version Compatibility

`fetch` is used unconditionally in `cmdWebsearch` (commands.cjs, line ~334). Node.js 16 doesn't include stable `fetch` support. The current `engines` field allows Node 16:

```json
"engines": { "node": ">=16.7.0" }
```

**Recommendation:** Either raise the minimum to `>=18.0.0` (Node 16 is end-of-life as of September 2023), or add a guard:

```js
if (typeof fetch === 'undefined') {
  output({ available: false, reason: 'fetch not available in Node < 18' }, raw, '');
  return;
}
```

The guard approach preserves Node 16 compatibility for users who don't need `websearch`.

---

## 6. Security Notes

- No credentials or secrets in source code
- Shell arguments in `execGit` are escaped via an allowlist regex — correct and conservative
- `isGitIgnored` uses `--no-index` to prevent tracked-file bypass — correct
- No user-supplied data is passed to `eval` or `Function` constructors
- `cmdWebsearch` uses the `BRAVE_API_KEY` from env, not from user input

---

## 7. What Was Implemented

| Change | File(s) |
|--------|---------|
| Added 27 tests for `cmdTemplateSelect` (minimal/standard/complex heuristics, raw flag, missing path error) | `tests/template.test.cjs` |
| Added tests for `cmdTemplateFill` summary type (fields, name, duplicate, missing phase) | `tests/template.test.cjs` |
| Added tests for `cmdTemplateFill` plan type (execute, tdd, wave, duplicate, missing phase) | `tests/template.test.cjs` |
| Added tests for `cmdTemplateFill` verification type (structure, name, duplicate, fields override, missing phase) | `tests/template.test.cjs` |
| Added tests for `cmdTemplateFill` unknown type and missing `--phase` guard | `tests/template.test.cjs` |
| Updated CHANGELOG.md | `CHANGELOG.md` |
| Added this research document | `docs/RESEARCH.md` |

**Test count:** 535 → 562 (+27)
**Overall line coverage:** 89.92% → 93.82% (+3.9pp)
**template.cjs line coverage:** 5.40% → 100% (+94.6pp)
