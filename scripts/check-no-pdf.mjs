/**
 * Las normas y documentos de terceros no se versionan: el repositorio es
 * público y sus derechos no lo permiten (`docs/references/normative`). El
 * `.gitignore` ya excluye `*.pdf`; esto también detiene un `git add -f`.
 */
import { execFileSync } from 'node:child_process';

let tracked;
try {
  tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
} catch {
  process.stdout.write('Sin git: no se revisan PDF versionados.\n');
  process.exit(0);
}
const pdfs = tracked.filter((file) => /\.pdf$/i.test(file));
if (pdfs.length) {
  process.stderr.write(`PDF versionados (no se permiten):\n${pdfs.map((file) => `  ${file}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write('Sin PDF versionados.\n');
