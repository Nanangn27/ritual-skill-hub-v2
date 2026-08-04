// scripts/test_evm.js
// Discover every tests/*.test.js file, run each in a fresh child process,
// aggregate pass/fail, exit nonzero on any failure.

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT, 'tests');

function discover() {
  if (!fs.existsSync(TESTS_DIR)) return [];
  return fs
    .readdirSync(TESTS_DIR)
    .filter((n) => n.endsWith('.test.js'))
    .sort()
    .map((n) => path.join(TESTS_DIR, n));
}

function run(file) {
  const rel = path.relative(ROOT, file);
  process.stdout.write('\n>>> ' + rel + '\n');
  const res = spawnSync(process.execPath, [file], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  return res.status === 0;
}

function main() {
  const files = discover();
  if (files.length === 0) {
    console.error('no test files found under tests/');
    process.exit(1);
  }
  const results = [];
  for (const f of files) {
    results.push({ file: path.relative(ROOT, f), ok: run(f) });
  }
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log('\n==== SUITE SUMMARY ====');
  for (const r of results) {
    console.log('  ' + (r.ok ? '\u2714' : '\u2718') + ' ' + r.file);
  }
  console.log('  ' + passed + ' file(s) passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main();
