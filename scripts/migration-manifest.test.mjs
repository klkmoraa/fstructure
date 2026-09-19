import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inventory, sha256, verifyFiles } from './migration-manifest.mjs';

test('captures deterministic SHA-256 content and excludes generated dependencies', () => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-manifest-'));
  writeFileSync(join(root, 'b.txt'), 'second');
  writeFileSync(join(root, 'a.txt'), 'first');
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'node_modules', 'ignored'), 'dependency');
  const result = inventory(root);
  assert.deepEqual(result.files.map(file => file.path), ['a.txt', 'b.txt']);
  assert.equal(result.files[0].sha256, sha256('first'));
  assert.deepEqual(inventory(root), result);
  assert.deepEqual(verifyFiles(root, result.files), []);
});

test('detects changed and missing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-manifest-'));
  writeFileSync(join(root, 'input'), 'original');
  const result = inventory(root);
  writeFileSync(join(root, 'input'), 'changed');
  assert.deepEqual(verifyFiles(root, result.files), ['input']);
  assert.deepEqual(verifyFiles(root, [{ ...result.files[0], path: 'missing' }]), ['missing']);
});

test('hashes symlink targets without following external directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'fstructure-manifest-'));
  symlinkSync('/not-a-real-directory', join(root, 'reference'));
  const result = inventory(root);
  assert.equal(result.files[0].kind, 'symlink');
  assert.deepEqual(verifyFiles(root, result.files), []);
});

test('rejects paths outside the verification root', () => {
  assert.throws(() => verifyFiles('/safe', [{ path: '../other', kind: 'file', sha256: '' }]), /Unsafe manifest path/);
});
