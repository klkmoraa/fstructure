/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ¿Respalda la evidencia registrada las constantes que implementa el código?
 *
 * `docs/design/normative-sources.json` fija su propia regla: «No clause, page,
 * equation, factor or limit may be asserted until verified against the exact
 * official document bytes recorded here». El validador de
 * `structuralDesignMigration.test.ts` comprueba que la evidencia cubra las
 * páginas declaradas y que el hash del extracto cuadre, pero nunca mira el
 * bloque `implementation`: una cláusula podía afirmar cualquier coeficiente
 * junto a un extracto que hablaba de otra cosa, y pasaba en verde.
 *
 * Caso que lo destapó: la cláusula 3.6.1 declara `fpp=0.85*fc` y la expresión
 * de beta1, y su único extracto verificado dice que la deformación unitaria del
 * concreto en compresión es 0.003. El extracto no menciona ninguna de las dos.
 *
 * Esta prueba mide la brecha y la congela. No la cierra: cerrarla exige
 * verificar cada constante contra el documento oficial y registrar el extracto
 * que la contiene, y el repositorio no versiona el PDF a propósito. Lo que sí
 * garantiza es que no crezca en silencio y que una cláusula nueva llegue con su
 * evidencia.
 *
 * Para saldar una entrada: añadir a la cláusula el extracto oficial que contenga
 * la constante, con su `excerptSha256`, y bajar el número aquí.
 */

const REGISTRY_PATH = resolve(process.cwd(), 'docs/design/normative-sources.json');

/** Metadatos descriptivos; sus números son unidades, no constantes de cálculo. */
const DESCRIPTIVE_KEYS = new Set(['units', 'variables', 'basis', 'range']);

/** `2` en `mm2` o un exponente no es un coeficiente normativo. */
const STRUCTURAL_LITERALS = new Set(['0', '1', '2']);

const UNIT_TOKENS = /\b(mm2|mm|MPa|N\*mm|kN|N)\b/g;
const NUMERIC = /\d+(?:\.\d+)?/g;

interface Clause {
  readonly clauseId?: string;
  readonly evidence?: readonly { readonly excerpt?: string }[];
  readonly implementation?: unknown;
}

const assertedLiterals = (node: unknown, key?: string): string[] => {
  if (key !== undefined && DESCRIPTIVE_KEYS.has(key)) return [];
  if (Array.isArray(node)) return node.flatMap((item) => assertedLiterals(item, key));
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([childKey, value]) => assertedLiterals(value, childKey));
  }
  if (typeof node === 'number' && Number.isFinite(node)) return [String(node)];
  if (typeof node === 'string') return node.replace(UNIT_TOKENS, '').match(NUMERIC) ?? [];
  return [];
};

/** Las normas usan matemáticas Unicode, separador de millares y espacios finos. */
const normalizeExcerpt = (text: string): string =>
  text.normalize('NFKC').replaceAll(',', '').replaceAll(' ', '').replaceAll(' ', '');

const unsubstantiated = (clause: Clause): string[] => {
  const excerpts = normalizeExcerpt((clause.evidence ?? []).map((item) => item.excerpt ?? '').join(' || '));
  const evidenceNumbers = (excerpts.match(NUMERIC) ?? []).map(Number);
  const asserted = [...new Set(assertedLiterals(clause.implementation))]
    .filter((literal) => !STRUCTURAL_LITERALS.has(literal));
  return asserted
    .filter((literal) => !evidenceNumbers.some((value) => Math.abs(value - Number(literal)) < 1e-12))
    .sort();
};

/**
 * Deuda registrada, cláusula por cláusula. Cada entrada es una constante que el
 * código aplica y que ningún extracto verificado contiene.
 */
const RECORDED_EVIDENCE_DEBT: Readonly<Record<string, readonly string[]>> = {
  '2.2.1-2.2.7.3': ['0.80', '0.85', '11000', '2700', '3500', '4400', '5000'],
  '3.6.1': ['0.65', '0.85', '1.05', '140', '30'],
  '3.8.2.1-3.8.2.2': ['0.75'],
  '5.2.2.1.1.1': ['0.5'],
  '5.5.3.1.1-5.5.3.1.2': ['0.08', '0.17'],
  '6.3.5.4.1-6.3.5.4.4': ['0.062', '0.35'],
  '6.3.7.6.2.2': ['0.33', '300', '4', '600'],
};

const clauses = (): Clause[] => {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as {
    standards: readonly { verifiedClauses?: readonly Clause[] }[];
  };
  return registry.standards.flatMap((standard) => [...(standard.verifiedClauses ?? [])]);
};

describe('respaldo documental de las constantes normativas', () => {
  const implemented = clauses().filter((clause) => clause.implementation !== undefined);

  it('encuentra cláusulas con implementación declarada', () => {
    expect(implemented.length).toBeGreaterThanOrEqual(9);
  });

  it.each(implemented)('la brecha de la cláusula $clauseId no crece', (clause) => {
    const expected = RECORDED_EVIDENCE_DEBT[clause.clauseId ?? ''] ?? [];
    expect(
      unsubstantiated(clause),
      `La cláusula ${clause.clauseId} cambió su respaldo documental. Si añadiste evidencia, baja su entrada en RECORDED_EVIDENCE_DEBT; si añadiste una constante, registra el extracto oficial que la contiene.`,
    ).toEqual([...expected]);
  });

  it('ninguna cláusula nueva llega sin respaldo', () => {
    const conDeuda = implemented
      .filter((clause) => unsubstantiated(clause).length > 0)
      .map((clause) => clause.clauseId);
    expect(conDeuda.sort()).toEqual(Object.keys(RECORDED_EVIDENCE_DEBT).sort());
  });

  it('la deuda total no aumenta', () => {
    const total = implemented.reduce((sum, clause) => sum + unsubstantiated(clause).length, 0);
    const registrada = Object.values(RECORDED_EVIDENCE_DEBT).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(registrada);
    expect(total).toBeLessThanOrEqual(22);
  });
});
