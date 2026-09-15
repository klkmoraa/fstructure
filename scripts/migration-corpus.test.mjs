import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { verifyFiles } from './migration-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../docs/migration/corpus-map.json', import.meta.url), 'utf8'));

test('every migrated or deduplicated artifact matches its recorded SHA-256', () => {
  assert.deepEqual(verifyFiles(root, manifest.records.map(record => ({ path: record.destination, kind: 'file', sha256: record.destinationSha256 }))), []);
  for (const record of manifest.records.filter(record => record.kind !== 'executable migrated test')) {
    assert.equal(record.sourceSha256, record.destinationSha256, record.destination);
  }
});

test('preserves ten original tests and nine executable mappings with one explicit obsolete contract', () => {
  const originals = manifest.records.filter(record => record.kind === 'verbatim historical corpus' && /\.test\.(ts|tsx)$/.test(record.destination));
  const executable = manifest.records.filter(record => record.kind === 'executable migrated test');
  assert.equal(originals.length, 10);
  assert.equal(executable.length, 9);
  const activeSources = new Set(executable.map(record => record.source));
  const referenceOnly = originals.filter(record => !activeSources.has(record.source));
  assert.equal(referenceOnly.length, 1);
  assert.equal(referenceOnly[0].destination, manifest.referenceOnlyTest.path);
  assert.ok(manifest.referenceOnlyTest.reason.length > 0);
});
