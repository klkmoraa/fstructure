import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';

export const ARCHIVED_FOUNDATION_PACKAGE = '@fusionstructure/foundation';
const FUSIONSTRUCTURE_PACKAGE_PREFIX = '@fusionstructure/';
const SIBLING_PRODUCT_DIRECTORIES = new Set([
  'foundation',
  'fstructure-space3d',
  'space3d',
  'fusionstructure-web',
  'web',
]);
const NON_LITERAL_DYNAMIC_SPECIFIER = '<non-literal dynamic module specifier>';
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'bundleDependencies',
  'bundledDependencies',
];

const isProductionTypeScriptFile = (path) => /(?<!\.(?:test|spec))\.(?:ts|tsx)$/.test(path);

const sourceFiles = (directory) => {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return isProductionTypeScriptFile(entry.name) ? [path] : [];
  });
};

const moduleSpecifier = (expression) => expression && ts.isStringLiteralLike(expression) ? expression.text : null;

export const dependencySpecifiersIn = (source, sourcePath = 'source.ts') => {
  const sourceFile = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const specifiers = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = moduleSpecifier(node.moduleSpecifier);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const specifier = moduleSpecifier(node.moduleSpecifier);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const specifier = moduleSpecifier(node.moduleReference.expression);
      if (specifier) specifiers.push(specifier);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      specifiers.push(node.argument.literal.text);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = (ts.isIdentifier(node.expression) && node.expression.text === 'require')
        || (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'require');
      if (isDynamicImport || isRequire) {
        const specifier = moduleSpecifier(node.arguments[0]);
        specifiers.push(specifier ?? NON_LITERAL_DYNAMIC_SPECIFIER);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return specifiers;
};

export const isForbiddenFoundationDependency = (specifier) => specifier === ARCHIVED_FOUNDATION_PACKAGE
  || specifier.startsWith(FUSIONSTRUCTURE_PACKAGE_PREFIX);

const escapesProjectRoot = (root, sourcePath, specifier) => {
  if (!specifier.startsWith('.')) return false;
  const fromRoot = relative(root, resolve(dirname(sourcePath), specifier));
  return fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot);
};

const packageDependencyEntries = (packageJson, section) => {
  const dependencies = packageJson[section];
  if (Array.isArray(dependencies)) return dependencies.filter((name) => typeof name === 'string').map((name) => [name, '']);
  if (!dependencies || typeof dependencies !== 'object') return [];
  return Object.entries(dependencies);
};

const isForbiddenPackageReference = (value) => typeof value === 'string'
  && (isForbiddenFoundationDependency(value)
    || value.includes(FUSIONSTRUCTURE_PACKAGE_PREFIX)
    || isSiblingProductProtocolReference(value));

const isSiblingProductProtocolReference = (value) => {
  const separator = value.indexOf(':');
  const protocol = value.slice(0, separator);
  const reference = value.slice(separator + 1);
  if (!['file', 'workspace', 'npm'].includes(protocol) || !reference) return false;

  if (protocol === 'npm') {
    const packageName = reference.startsWith('@')
      ? reference.slice(0, reference.indexOf('@', 1) === -1 ? reference.length : reference.indexOf('@', 1))
      : reference.split('@', 1)[0];
    return SIBLING_PRODUCT_DIRECTORIES.has(packageName);
  }

  return reference.replaceAll('\\', '/').split('/').some((segment) => SIBLING_PRODUCT_DIRECTORIES.has(segment));
};

export const findFoundationDependencyViolations = (root) => {
  const resolvedRoot = resolve(root);
  const violations = [];
  for (const path of sourceFiles(join(resolvedRoot, 'src'))) {
    const source = readFileSync(path, 'utf8');
    for (const specifier of dependencySpecifiersIn(source, path)) {
      if (specifier === NON_LITERAL_DYNAMIC_SPECIFIER
        || isForbiddenFoundationDependency(specifier)
        || escapesProjectRoot(resolvedRoot, path, specifier)) {
        violations.push(`${relative(resolvedRoot, path)} -> ${specifier}`);
      }
    }
  }

  const packagePath = join(resolvedRoot, 'package.json');
  if (!existsSync(packagePath)) {
    violations.push('package.json is required to verify local Foundation ownership');
    return violations;
  }

  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [dependency, version] of packageDependencyEntries(packageJson, section)) {
      if (isForbiddenPackageReference(dependency) || isForbiddenPackageReference(version)) {
        const reference = typeof version === 'string' && version.length > 0 ? `${dependency} (${version})` : dependency;
        violations.push(`package.json#${section} -> ${reference}`);
      }
    }
  }
  return violations;
};

const parseRoot = (argumentsList) => {
  if (argumentsList.length === 0) return process.cwd();
  if (argumentsList.length === 2 && argumentsList[0] === '--root') return resolve(argumentsList[1]);
  throw new Error('Usage: node scripts/check-local-foundation-dependencies.mjs [--root <project-root>]');
};

export const runFoundationDependencyGate = (root) => {
  const violations = findFoundationDependencyViolations(root);
  if (violations.length === 0) {
    process.stdout.write('Foundation dependency boundary passed.\n');
    return 0;
  }
  process.stderr.write(`Foundation dependency boundary failed:\n${violations.map((violation) => `- ${violation}`).join('\n')}\n`);
  return 1;
};

const isMainModule = () => process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule()) {
  try {
    process.exitCode = runFoundationDependencyGate(parseRoot(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`Foundation dependency boundary failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
