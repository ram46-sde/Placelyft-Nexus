import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  formatCtc,
  CRORE_THRESHOLD_HUNDREDTHS,
  UNIT_LPA,
  UNIT_CR,
  CURRENCY_PREFIX,
  EM_DASH,
  validateAndParseCtcInput,
  mapOutcomeResult,
  validateRevokeReasonInput,
} from './placementMetrics.js';

test('1. formatCtc Approved Exact Table Assertions', async (t) => {
  const table = [
    { input: 0, expected: '₹ 0 LPA' },
    { input: 0.5, expected: '₹ 0.5 LPA' },
    { input: 12.5, expected: '₹ 12.5 LPA' },
    { input: 99, expected: '₹ 99 LPA' },
    { input: 99.5, expected: '₹ 99.5 LPA' },
    { input: 99.99, expected: '₹ 99.99 LPA' },
    { input: 100, expected: '₹ 1 Cr' },
    { input: 100.01, expected: '₹ 1.0001 Cr' },
    { input: 100.5, expected: '₹ 1.005 Cr' },
    { input: 120, expected: '₹ 1.2 Cr' },
    { input: 123.45, expected: '₹ 1.2345 Cr' },
    { input: 150, expected: '₹ 1.5 Cr' },
    { input: 175, expected: '₹ 1.75 Cr' },
    { input: 199.99, expected: '₹ 1.9999 Cr' },
    { input: 200, expected: '₹ 2 Cr' },
  ];

  for (const { input, expected } of table) {
    await t.test(`formats ${input} -> "${expected}"`, () => {
      assert.equal(formatCtc(input), expected);
    });
  }
});

test('2. formatCtc Invalid Inputs (Must return "—")', async (t) => {
  const invalids = [
    { label: 'null', val: null },
    { label: 'undefined', val: undefined },
    { label: 'NaN', val: NaN },
    { label: 'Infinity', val: Infinity },
    { label: '-Infinity', val: -Infinity },
    { label: 'negative number -1', val: -1 },
    { label: 'negative decimal -0.01', val: -0.01 },
    { label: 'numeric string "12.5"', val: '12.5' },
    { label: 'empty string ""', val: '' },
    { label: 'non-numeric string "abc"', val: 'abc' },
    { label: 'more than 2 decimals: 100.123', val: 100.123 },
    { label: 'more than 2 decimals: 12.345', val: 12.345 },
    { label: 'more than 2 decimals: 0.001', val: 0.001 },
  ];

  for (const { label, val } of invalids) {
    await t.test(`returns em-dash for ${label}`, () => {
      assert.equal(formatCtc(val), EM_DASH);
    });
  }
});

test('3. formatCtc Determinism & Purity', () => {
  assert.equal(formatCtc(123.45), formatCtc(123.45));
  assert.equal(formatCtc(100), formatCtc(100));
  assert.equal(formatCtc(99.5), formatCtc(99.5));
  assert.equal(formatCtc(0), formatCtc(0));
  assert.equal(formatCtc(null), formatCtc(null));
});

test('4. Named Constants Validation', () => {
  assert.equal(CRORE_THRESHOLD_HUNDREDTHS, 10000);
  assert.equal(UNIT_LPA, 'LPA');
  assert.equal(UNIT_CR, 'Cr');
  assert.equal(CURRENCY_PREFIX, '₹ ');
  assert.equal(EM_DASH, '—');
});

test('5. Guard Test: Scan client/src for hand-built unit strings outside formatCtc', () => {
  const clientSrcDir = path.resolve(import.meta.dirname, '..');

  function walk(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        results.push(...walk(full));
      } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
        results.push(full);
      }
    }
    return results;
  }

  // Explicit allow-list for legitimate non-bypassing occurrences:
  // - placementMetrics.js (the formatter implementation and CTC parser)
  // - placementMetrics.test.js (this test suite)
  // - VerifyOutcomeModal.jsx: static unit adornment ("LPA"), input echo for review (`₹ ${ctcInput} LPA`), validation help text
  // - CreateDriveModal.jsx: drive placeholder ("e.g. 12 LPA or 8-10 LPA")
  const ALLOWED_MATCHES = [
    'placementMetrics.js',
    'placementMetrics.test.js',
    'VerifyOutcomeModal.jsx',
    'CreateDriveModal.jsx',
  ];

  const files = walk(clientSrcDir);
  const violations = [];

  for (const file of files) {
    const basename = path.basename(file);
    if (ALLOWED_MATCHES.includes(basename)) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      // Flag template literals or concatenations producing LPA or Cr
      if (
        /(`[^`]*\${[^`]*}\s*(LPA|Cr)[^`]*`)|(['"][^'"]*['"]\s*\+\s*[^;\n]*\b(LPA|Cr)\b)|(\b(LPA|Cr)\b\s*['"][^'"]*['"])/i.test(
          line
        )
      ) {
        violations.push(`${path.relative(clientSrcDir, file)}:${idx + 1} -> ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(violations, [], `Hand-built unit strings detected outside allow-list:\n${violations.join('\n')}`);
});

