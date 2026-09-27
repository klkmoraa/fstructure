import type { ReactElement } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { ElementCheck } from '../../../design/elements/shared';
import type { Takeoff } from '../../../design/elements/takeoff';

export type DesignElementKind = 'beam' | 'column' | 'footing';

export interface ReportRow { readonly label: string; readonly value: string }
export interface ReportGroup { readonly title: string; readonly rows: readonly ReportRow[] }
export interface ReportValue { readonly symbol: string; readonly label: string; readonly value: string }
export interface ReportTable { readonly title: string; readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] }

/** Dibujo de la lámina; el PDF lo rasteriza con el mismo componente que se ve en pantalla. */
export interface ReportFigure {
  readonly title: string;
  readonly note?: string;
  readonly render: () => ReactElement;
}

/** Otra solución del mismo elemento con la misma entrada (el armado propuesto frente al propio). */
export interface ReportAlternative {
  readonly label: string;
  readonly status: 'pass' | 'fail' | 'warning';
  readonly governingRatio: number;
  readonly steelKg: number;
  readonly reinforcement: readonly ReportRow[];
}

/**
 * Instantánea de un diseño: lo que la memoria copiada y el PDF reproducen. Se
 * arma del mismo resultado que muestra la mesa, así que ambos dicen lo mismo.
 */
export interface DesignReport {
  readonly element: DesignElementKind;
  /** «Viga 25 × 50 cm». */
  readonly title: string;
  /** Clave que le da la persona usuaria («V-1»); vacía si no la dio. */
  readonly tag: string;
  /** Ubicación en la obra («Eje 3, B–C, nivel 2»). */
  readonly place: string;
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
  /** Datos de entrada en unidades de trabajo, agrupados como en el formulario. */
  readonly data: readonly ReportGroup[];
  readonly reinforcement: readonly ReportRow[];
  readonly values: readonly ReportValue[];
  readonly tables: readonly ReportTable[];
  readonly takeoff: Takeoff;
  readonly figures: readonly ReportFigure[];
  readonly alternative?: ReportAlternative;
}

/** «V-1 · Viga 25 × 50 cm», o sólo el título si no hay clave. */
export const reportHeading = (report: Pick<DesignReport, 'tag' | 'title'>) => report.tag ? `${report.tag} · ${report.title}` : report.title;

const CLOSING_LINE = /^FStructure · /;

/** Memoria copiable: identificación, la memoria del elemento y lo sin evaluar antes de la firma. */
export function memoText(report: DesignReport): string {
  const lines = report.memo.split('\n');
  const closing = lines.length && CLOSING_LINE.test(lines[lines.length - 1]!) ? lines.pop()! : undefined;
  const identity = [report.tag, report.place].filter(Boolean).join(' · ');
  return [
    ...(identity ? [identity] : []),
    ...lines,
    ...(report.outOfScope.length ? [`○ Sin evaluar (fuera del alcance del taller): ${report.outOfScope.map((check) => check.label).join(' · ')}`] : []),
    ...(closing ? [closing] : []),
  ].join('\n');
}

/** JSON con las llaves ordenadas: la misma entrada da siempre la misma huella. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 de la entrada; identifica la instantánea que reproduce un PDF. */
export async function snapshotHash(report: Pick<DesignReport, 'element' | 'code' | 'input'>): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson({ element: report.element, code: report.code, input: report.input }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
