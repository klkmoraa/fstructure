import type { ReactElement } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { ElementCheck } from '../../../design/elements/shared';
import type { Takeoff } from '../../../design/elements/takeoff';
import type { OriginState, WorkbenchOrigin } from './LinkedPieceOrigin';

export type DesignElementKind = 'beam' | 'column' | 'frame' | 'footing' | 'section' | 'flexure';

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
  /** Identifica un modelo experimental que no implementa el perfil normativo del taller. */
  readonly basisLabel?: string;
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
  readonly origin?: WorkbenchOrigin;
  readonly originSourceStatus?: OriginState['source'];
  readonly originEdited?: boolean;
}

/** «V-1 · Viga 25 × 50 cm», o sólo el título si no hay clave. */
export const reportHeading = (report: Pick<DesignReport, 'tag' | 'title'>) => report.tag ? `${report.tag} · ${report.title}` : report.title;

/**
 * Titular del veredicto, el mismo en la mesa, la memoria y el PDF. Lo decide lo
 * que el taller evalúa; lo que queda fuera de su alcance se informa aparte, como
 * nota, y no cambia el titular. Sin cálculo posible el titular es «Faltan datos».
 */
export const verdictHeadline = (status: DesignReport['status']) =>
  status === 'fail' ? 'No cumple' : status === 'warning' ? 'Revisión pendiente' : 'Cumple';

export const MISSING_DATA = 'Faltan datos';

/** «Faltan: …» con los mensajes de validación tal cual, sin el punto final de cada uno. */
export const missingDataText = (errors: readonly string[]) =>
  errors.length ? `Faltan: ${errors.map((error) => error.trim().replace(/\.$/, '')).join(' · ')}.` : `${MISSING_DATA}.`;

/** Nota de alcance: cuántas verificaciones que la norma pide no calcula el taller. */
export const outOfScopeNote = (count: number) =>
  `${count} ${count === 1 ? 'verificación' : 'verificaciones'} fuera del alcance del taller`;

export function withReportOrigin(report: DesignReport, origin: WorkbenchOrigin | undefined, state?: OriginState): DesignReport {
  if (!origin) return report;
  const snapshot = origin.snapshot;
  const { actions } = snapshot;
  const flexureScope = report.element === 'flexure' ? [{ id: 'linked-flexure-vector-scope', label: 'Axial, cortante, torsión y flexión biaxial del modelo no se evalúan en esta flexión simple.', status: 'out-of-scope' as const,
    reference: { standard: 'complementary' as const, clauseIds: [], label: 'Alcance del cálculo vinculado' },
    note: `Se conserva el vector concurrente completo. Esta pieza usa sólo Mz = ${actions.mzKnm} kN·m como Mu; N, Vy, Vz, T y My no entran en la resistencia de flexión.` }] : [];
  const group: ReportGroup = { title: 'Origen vinculado · modelo', rows: [
    { label: 'Fuente', value: `${snapshot.source.kind === 'model2d' ? 'Modelo 2D' : 'Modelo 3D'} · proyecto ${snapshot.source.projectId} · revisión ${snapshot.source.revision}` },
    { label: 'Miembro / eje', value: `${snapshot.member.label} (${snapshot.source.memberId})${snapshot.source.axisId ? ` · ${snapshot.source.axisId}` : ''}` },
    { label: 'Estado y factores', value: `${snapshot.target.label} (${snapshot.target.id}) · ${snapshot.target.factors.map((factor) => `${factor.caseId} × ${factor.factor}`).join(' + ') || 'caso directo'}` },
    { label: 'Estación y alcance', value: `x = ${snapshot.station.xM} m desde i · ${snapshot.station.side} · ${snapshot.axes.convention}` },
    { label: 'Acciones originales', value: `N ${actions.nKn} kN · Vy ${actions.vyKn} kN · Vz ${actions.vzKn} kN · T ${actions.torsionKnm} kN·m · My ${actions.myKnm} kN·m · Mz ${actions.mzKnm} kN·m` },
    { label: 'Base local', value: snapshot.axes.localBasis.map((axis) => `(${axis.join(', ')})`).join(' · ') },
    ...(report.element === 'flexure' ? [{ label: 'Alcance calculado', value: `Flexión simple rectangular con Mz = ${actions.mzKnm} kN·m. El vector conserva N, Vy, Vz, T y My, pero estas acciones no se evalúan ni se convierten a una interacción espacial.` }] : []),
    { label: 'Vigencia de origen', value: `${state?.source === 'current' ? 'Vigente' : state?.source === 'stale' ? 'Desactualizado' : 'No comprobable'}${state?.edited ? ' · copia editada' : ''}` },
  ] };
  const vector = `N ${actions.nKn} kN · Vy ${actions.vyKn} kN · Vz ${actions.vzKn} kN · T ${actions.torsionKnm} kN·m · My ${actions.myKnm} kN·m · Mz ${actions.mzKnm} kN·m`;
  return { ...report, origin, ...(state ? { originSourceStatus: state.source, originEdited: state.edited } : {}), outOfScope: [...report.outOfScope, ...flexureScope], data: [...report.data, group], memo: `${report.memo}\nORIGEN DEL MODELO · ${snapshot.source.kind === 'model2d' ? 'Modelo 2D' : 'Modelo 3D'} · ${snapshot.member.label} (${snapshot.source.memberId}) · ${snapshot.target.label} · x = ${snapshot.station.xM} m desde i (${snapshot.station.side}).\nFactores: ${snapshot.target.factors.map((factor) => `${factor.caseId} × ${factor.factor}`).join(' + ') || 'caso directo'}. ${vector}.\n${snapshot.axes.convention}. Base local: ${snapshot.axes.localBasis.map((axis) => `(${axis.join(', ')})`).join(' · ')}.\nOrigen ${state?.source ?? 'no comprobable'}${state?.edited ? '; copia editada' : ''}.${flexureScope.length ? `\nALCANCE PARCIAL · ${flexureScope[0]!.note}` : ''}` };
}

const CLOSING_LINE = /^FStructure · /;

/** Memoria copiable: identificación, la memoria del elemento y la nota de alcance antes de la firma. */
export function memoText(report: DesignReport): string {
  const lines = report.memo.split('\n');
  const closing = lines.length && CLOSING_LINE.test(lines[lines.length - 1]!) ? lines.pop()! : undefined;
  const identity = [report.tag, report.place].filter(Boolean).join(' · ');
  return [
    ...(identity ? [identity] : []),
    ...lines,
    ...(report.outOfScope.length ? [`○ ${outOfScopeNote(report.outOfScope.length)}: ${report.outOfScope.map((check) => check.label).join(' · ')}`] : []),
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
export async function snapshotHash(report: Pick<DesignReport, 'element' | 'code' | 'input' | 'origin'>): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson({ element: report.element, code: report.code, input: report.input, origin: report.origin ?? null }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
