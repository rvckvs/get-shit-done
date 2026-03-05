/**
 * GSD Tools Tests - Template
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePhaseDir(tmpDir, dirName) {
  const dir = path.join(tmpDir, '.planning', 'phases', dirName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── template select ─────────────────────────────────────────────────────────

describe('template select command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('selects minimal template for simple plan (few tasks, few files, no decisions)', () => {
    const planContent = `---
phase: "01-setup"
plan: "01"
---

# Phase 1 Plan 01: Basic Setup

## Tasks

### Task 1
Do something simple.
`;
    const planPath = path.join(tmpDir, 'simple-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'simple-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'minimal', 'Simple plan should use minimal template');
    assert.ok(output.template.includes('summary-minimal'), 'Template path should include minimal');
  });

  test('selects standard template for medium-complexity plan', () => {
    // 3 tasks, 4 files (crosses minimal threshold), no decisions
    const fileRefs = Array.from({ length: 4 }, (_, i) => `\`src/module${i}/index.ts\``).join('\n');
    const tasks = Array.from({ length: 3 }, (_, i) => `### Task ${i + 1}\nDo something.`).join('\n\n');
    const planContent = `---
phase: "02-core"
plan: "01"
---

# Phase 2 Plan 01: Core Implementation

## Files
${fileRefs}

## Tasks
${tasks}
`;
    const planPath = path.join(tmpDir, 'standard-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'standard-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard', 'Medium plan should use standard template');
  });

  test('selects complex template when plan mentions decisions', () => {
    const planContent = `---
phase: "03-api"
plan: "01"
---

# Phase 3 Plan 01: API Design

## Decision: Use REST vs GraphQL

We made an important architectural decision here.

## Files
\`src/api/routes.ts\`
\`src/api/handler.ts\`

## Tasks

### Task 1
Build the API layer.
`;
    const planPath = path.join(tmpDir, 'decision-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'decision-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex', 'Plan with decisions should use complex template');
    assert.ok(output.hasDecisions, 'hasDecisions should be true');
  });

  test('selects complex template for plan with many file references', () => {
    // >6 files forces complex
    const fileRefs = Array.from({ length: 7 }, (_, i) => `\`src/module${i}/index.ts\``).join('\n');
    const planContent = `---
phase: "04-refactor"
plan: "01"
---

# Phase 4 Plan 01: Refactor

## Files
${fileRefs}

## Tasks
### Task 1
Refactor everything.
`;
    const planPath = path.join(tmpDir, 'many-files-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'many-files-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex', 'Plan with many files should use complex template');
  });

  test('selects complex template for plan with many tasks', () => {
    // >5 tasks forces complex
    const tasks = Array.from({ length: 6 }, (_, i) => `### Task ${i + 1}\nDo task ${i + 1}.`).join('\n\n');
    const planContent = `---
phase: "05-feature"
plan: "01"
---

# Phase 5 Plan 01: Feature Implementation

## Tasks
${tasks}
`;
    const planPath = path.join(tmpDir, 'many-tasks-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'many-tasks-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'complex', 'Plan with many tasks should use complex template');
  });

  test('returns standard template when plan file does not exist (graceful fallback)', () => {
    const result = runGsdTools(['template', 'select', 'nonexistent-plan.md'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.strictEqual(output.type, 'standard', 'Missing file should fall back to standard');
    assert.ok(output.error, 'Should include error property explaining the fallback');
  });

  test('--raw flag returns template path string', () => {
    const planContent = `---\nphase: "01"\n---\n\n# Plan\n\n### Task 1\nSimple.\n`;
    const planPath = path.join(tmpDir, 'raw-plan.md');
    fs.writeFileSync(planPath, planContent);

    const result = runGsdTools(['template', 'select', 'raw-plan.md', '--raw'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.includes('summary-'), 'Raw output should be a template path');
    assert.ok(!result.output.startsWith('{'), 'Raw output should not be JSON');
  });
});

// ─── template fill summary ─────────────────────────────────────────────────────

describe('template fill summary command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates SUMMARY.md from template with correct frontmatter fields', () => {
    makePhaseDir(tmpDir, '01-foundation');

    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '01', '--plan', '01'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');
    assert.ok(output.path.endsWith('-SUMMARY.md'), 'Path should end with -SUMMARY.md');
    assert.strictEqual(output.template, 'summary', 'Template type should be "summary"');

    const fullPath = path.join(tmpDir, output.path);
    assert.ok(fs.existsSync(fullPath), 'Summary file should exist on disk');

    const content = fs.readFileSync(fullPath, 'utf-8');
    assert.ok(content.includes('---'), 'Should have YAML frontmatter delimiters');
    assert.ok(content.includes('phase:'), 'Should have phase field');
    assert.ok(content.includes('completed:'), 'Should have completed field');
    assert.ok(content.includes('key-decisions:'), 'Should have key-decisions field');
  });

  test('creates SUMMARY.md with custom name option', () => {
    makePhaseDir(tmpDir, '02-core');

    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '02', '--plan', '01', '--name', 'Core Logic'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('Core Logic'), 'Should contain the custom name');
  });

  test('returns error when SUMMARY.md already exists', () => {
    const phaseDir = makePhaseDir(tmpDir, '03-api');
    fs.writeFileSync(path.join(phaseDir, '03-01-SUMMARY.md'), '# Existing summary\n');

    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '03', '--plan', '01'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should report an error');
    assert.ok(output.error.includes('already exists'), 'Error should mention file already exists');
  });

  test('returns error when phase does not exist', () => {
    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '99', '--plan', '01'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should return an error for nonexistent phase');
  });

  test('applies extra fields from --fields JSON argument', () => {
    makePhaseDir(tmpDir, '04-auth');

    const extraFields = JSON.stringify({ subsystem: 'auth', tags: ['security'] });
    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '04', '--plan', '01', '--fields', extraFields],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('subsystem:'), 'Should include injected field');
  });

  test('defaults plan number to 01 when --plan not provided', () => {
    makePhaseDir(tmpDir, '05-db');

    const result = runGsdTools(
      ['template', 'fill', 'summary', '--phase', '05'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');
    assert.ok(output.path.includes('05-01-SUMMARY.md'), 'Should default to plan 01');
  });
});

// ─── template fill plan ──────────────────────────────────────────────────────

describe('template fill plan command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates PLAN.md with execute type by default', () => {
    makePhaseDir(tmpDir, '01-setup');

    const result = runGsdTools(
      ['template', 'fill', 'plan', '--phase', '01', '--plan', '01'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');
    assert.ok(output.path.endsWith('-PLAN.md'), 'Path should end with -PLAN.md');
    assert.strictEqual(output.template, 'plan', 'Template type should be "plan"');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('type: execute'), 'Should default to execute type');
    assert.ok(content.includes('wave:'), 'Should include wave field');
    assert.ok(content.includes('autonomous:'), 'Should include autonomous field');
    assert.ok(content.includes('## Tasks'), 'Should have Tasks section');
  });

  test('creates PLAN.md with tdd type when --type tdd is specified', () => {
    makePhaseDir(tmpDir, '02-core');

    const result = runGsdTools(
      ['template', 'fill', 'plan', '--phase', '02', '--plan', '01', '--type', 'tdd'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('type: tdd'), 'Should use tdd type');
  });

  test('creates PLAN.md with specified wave number', () => {
    makePhaseDir(tmpDir, '03-api');

    const result = runGsdTools(
      ['template', 'fill', 'plan', '--phase', '03', '--plan', '02', '--wave', '2'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('wave: 2'), 'Should use wave 2');
  });

  test('returns error when PLAN.md already exists', () => {
    const phaseDir = makePhaseDir(tmpDir, '04-auth');
    fs.writeFileSync(path.join(phaseDir, '04-01-PLAN.md'), '# Existing plan\n');

    const result = runGsdTools(
      ['template', 'fill', 'plan', '--phase', '04', '--plan', '01'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should report an error for existing file');
  });

  test('returns error when phase does not exist', () => {
    const result = runGsdTools(
      ['template', 'fill', 'plan', '--phase', '99'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should return an error for nonexistent phase');
  });
});

// ─── template fill verification ───────────────────────────────────────────────

describe('template fill verification command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates VERIFICATION.md with correct structure', () => {
    makePhaseDir(tmpDir, '01-foundation');

    const result = runGsdTools(
      ['template', 'fill', 'verification', '--phase', '01'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');
    assert.ok(output.path.endsWith('-VERIFICATION.md'), 'Path should end with -VERIFICATION.md');
    assert.strictEqual(output.template, 'verification', 'Template type should be "verification"');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('status: pending'), 'Should have pending status in frontmatter');
    assert.ok(content.includes('## Observable Truths'), 'Should have Observable Truths section');
    assert.ok(content.includes('## Required Artifacts'), 'Should have Required Artifacts section');
    assert.ok(content.includes('## Key Link Verification'), 'Should have Key Link Verification section');
    assert.ok(content.includes('## Requirements Coverage'), 'Should have Requirements Coverage section');
  });

  test('creates VERIFICATION.md using phase name when provided', () => {
    makePhaseDir(tmpDir, '02-core-logic');

    const result = runGsdTools(
      ['template', 'fill', 'verification', '--phase', '02', '--name', 'Core Logic'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('Core Logic'), 'Should reference the phase name');
  });

  test('returns error when VERIFICATION.md already exists', () => {
    const phaseDir = makePhaseDir(tmpDir, '03-api');
    fs.writeFileSync(path.join(phaseDir, '03-VERIFICATION.md'), '# Existing verification\n');

    const result = runGsdTools(
      ['template', 'fill', 'verification', '--phase', '03'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should report an error for existing file');
  });

  test('returns error when phase does not exist', () => {
    const result = runGsdTools(
      ['template', 'fill', 'verification', '--phase', '99'],
      tmpDir
    );
    assert.ok(result.success, 'Command should exit cleanly');

    const output = JSON.parse(result.output);
    assert.ok(output.error, 'Should return an error for nonexistent phase');
  });

  test('applies --fields JSON overrides to frontmatter', () => {
    makePhaseDir(tmpDir, '04-db');

    const extraFields = JSON.stringify({ status: 'in-progress' });
    const result = runGsdTools(
      ['template', 'fill', 'verification', '--phase', '04', '--fields', extraFields],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);

    const output = JSON.parse(result.output);
    assert.ok(output.created, 'File should be created');

    const content = fs.readFileSync(path.join(tmpDir, output.path), 'utf-8');
    assert.ok(content.includes('status: in-progress'), 'Should apply field override');
  });
});

// ─── template fill - unknown type ────────────────────────────────────────────

describe('template fill unknown type', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('exits non-zero for unknown template type', () => {
    makePhaseDir(tmpDir, '01-setup');

    const result = runGsdTools(
      ['template', 'fill', 'bogus', '--phase', '01'],
      tmpDir
    );
    assert.strictEqual(result.success, false, 'Should exit with non-zero for unknown type');
    assert.ok(result.error.toLowerCase().includes('unknown'), 'Error should mention unknown type');
  });

  test('exits non-zero when --phase is missing', () => {
    const result = runGsdTools(
      ['template', 'fill', 'summary'],
      tmpDir
    );
    assert.strictEqual(result.success, false, 'Should exit with non-zero when phase is missing');
  });
});

// ─── template select - raw output ─────────────────────────────────────────────

describe('template select --raw output', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--raw flag returns fallback path when file is missing', () => {
    const result = runGsdTools(
      ['template', 'select', 'no-such-file.md', '--raw'],
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);
    assert.ok(result.output.startsWith('templates/'), 'Raw output should be a template path');
  });

  test('exits non-zero when no plan path is provided', () => {
    const result = runGsdTools(['template', 'select'], tmpDir);
    assert.strictEqual(result.success, false, 'Should exit with non-zero when plan path is missing');
    assert.ok(result.error.includes('plan-path required'), 'Error should mention plan-path required');
  });
});
