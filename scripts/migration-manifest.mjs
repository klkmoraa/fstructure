import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export const excludedDirectories = ['.git', 'node_modules', 'dist', '.superpowers', '.agents', '.claude', '.playwright', '.playwright-cli', '__pycache__', 'qa-artifacts', 'tmp'];
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

export function inventory(root) {
  const files = [];
  const repositories = [];
  function walk(directory) {
    if (existsSync(join(directory, '.git'))) {
      const git = (...args) => execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trimEnd();
      repositories.push({ path: relative(root, directory) || '.', commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), branch: git('branch', '--show-current'), remotes: git('remote', '-v'), status: git('status', '--porcelain=v1', '--untracked-files=all'), gitLink: lstatSync(join(directory, '.git')).isFile() ? readFileSync(join(directory, '.git'), 'utf8').trim() : null });
    }
    for (const name of readdirSync(directory).sort()) {
      if (excludedDirectories.includes(name)) continue;
      const absolute = join(directory, name);
      const path = relative(root, absolute);
      // Generated evidence cannot include its own digest.
      if (path === 'docs/migration' || path.endsWith('/docs/migration')) continue;
      const stat = lstatSync(absolute);
      if (stat.isSymbolicLink()) files.push({ path, kind: 'symlink', target: readlinkSync(absolute), sha256: sha256(readlinkSync(absolute)) });
      else if (stat.isDirectory()) walk(absolute);
      else if (stat.isFile()) files.push({ path, kind: 'file', bytes: stat.size, sha256: sha256(readFileSync(absolute)) });
    }
  }
  walk(root);
  return { files, repositories };
}

export function verifyFiles(root, files) {
  const failures = [];
  for (const file of files) {
    const absolute = resolve(root, file.path);
    if (!absolute.startsWith(`${resolve(root)}/`)) throw new Error(`Unsafe manifest path: ${file.path}`);
    try {
      const stat = lstatSync(absolute);
      const actual = file.kind === 'symlink' && stat.isSymbolicLink() ? readlinkSync(absolute) : file.kind === 'file' && stat.isFile() ? readFileSync(absolute) : null;
      if (actual === null || sha256(actual) !== file.sha256) failures.push(file.path);
    } catch { failures.push(file.path); }
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, root, ...names] = process.argv.slice(2);
  if (mode === 'capture') {
    console.log(JSON.stringify({ schemaVersion: 1, algorithm: 'sha256', exclusions: [...excludedDirectories, '**/docs/migration'], roots: names.map(name => ({ name, ...inventory(join(root, name)) })) }, null, 2));
  } else if (mode === 'verify') {
    const manifest = JSON.parse(readFileSync(names[0], 'utf8'));
    const failures = manifest.roots.flatMap(item => verifyFiles(join(root, item.name), item.files).map(path => `${item.name}/${path}`));
    console.log(JSON.stringify({ filesChecked: manifest.roots.reduce((sum, item) => sum + item.files.length, 0), failures }, null, 2));
    process.exitCode = failures.length ? 1 : 0;
  } else throw new Error('Usage: node scripts/migration-manifest.mjs capture ROOT NAME... | verify ROOT MANIFEST');
}
