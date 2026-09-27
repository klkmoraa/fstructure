import type { DesignCodeId } from '../../../design/elements/codes';
import type { ElementCheck } from '../../../design/elements/shared';

/**
 * Instantánea de un diseño: lo que la memoria copiada y el PDF reproducen. Se
 * arma del mismo resultado que muestra la mesa, así que ambos dicen lo mismo.
 */
export interface DesignReport {
  readonly element: 'beam' | 'column' | 'footing';
  /** «Viga 25 × 50 cm». */
  readonly title: string;
  readonly code: DesignCodeId;
  readonly status: 'pass' | 'fail' | 'warning';
  readonly governingRatio: number;
  /** Memoria de texto propia del elemento (sin las líneas de alcance). */
  readonly memo: string;
  readonly checks: readonly ElementCheck[];
  readonly notes: readonly ElementCheck[];
  readonly outOfScope: readonly ElementCheck[];
  /** Entrada del motor, en sus unidades internas: es lo que firma la huella. */
  readonly input: unknown;
}

const CLOSING_LINE = /^FStructure · /;

/** Memoria copiable: la del elemento más lo que quedó sin evaluar, antes de la firma. */
export function memoText(report: DesignReport): string {
  if (!report.outOfScope.length) return report.memo;
  const lines = report.memo.split('\n');
  const closing = lines.length && CLOSING_LINE.test(lines[lines.length - 1]!) ? lines.pop()! : undefined;
  return [
    ...lines,
    `○ Sin evaluar (fuera del alcance del taller): ${report.outOfScope.map((check) => check.label).join(' · ')}`,
    ...(closing ? [closing] : []),
  ].join('\n');
}

/** JSON con las llaves ordenadas: la misma entrada da siempre la misma huella. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 de la entrada; identifica la instantánea que reproduce un PDF. */
export async function snapshotHash(report: DesignReport): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson({ element: report.element, code: report.code, input: report.input }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
