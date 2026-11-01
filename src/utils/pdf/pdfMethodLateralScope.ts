/**
 * What the Portal and Cantilever methods leave out, said in the report before their numbers.
 *
 * Both methods distribute lateral load only. When the combination also carries gravity — and a
 * building frame always does — the method still applies, but the reader has to be told, in so
 * many words, which actions were not distributed and that their effect is obtained separately
 * and superposed. A table of column moments without that sentence would read as the design
 * moments of the frame, which it is not.
 */
import type { ExcludedAction } from '../../analysis-methods/lateralActions';
import { number } from './pdfFormat';
import type { ReportContext } from './reportContext';

const GROUPS: ReadonlyArray<{ kind: ExcludedAction['kind']; label: string }> = [
  { kind: 'beam-gravity', label: 'Cargas verticales sobre las vigas' },
  { kind: 'column-axial', label: 'Cargas a lo largo del eje de las columnas' },
  { kind: 'self-weight', label: 'Peso propio de las barras' },
  { kind: 'nodal-vertical', label: 'Componente vertical de las cargas en nudos' },
  { kind: 'nodal-moment', label: 'Momentos aplicados en nudos' },
  { kind: 'initial-effect', label: 'Efectos iniciales (temperatura o deformación impuesta)' },
  { kind: 'imposed-displacement', label: 'Desplazamientos impuestos en apoyos' },
];

const describe = (action: ExcludedAction): string => {
  const where = action.memberId ?? action.nodeId;
  const factor = action.factor !== 1 ? `factor ${number(action.factor, 4)}` : '';
  const detail = [where, factor].filter(Boolean).join(', ');
  return detail ? `${action.loadId} (${detail})` : action.loadId;
};

/** One paragraph and a list: what was left out, and that it has to be superposed. */
export const drawLateralScope = (context: ReportContext, excluded: readonly ExcludedAction[], methodName: string): void => {
  const { layout } = context;
  if (!excluded.length) {
    layout.text(
      `Esta combinación sólo lleva carga lateral en los nudos: el ${methodName} la reparte entera y no queda ninguna `
      + 'acción vertical que superponer.',
      8.3, layout.fonts.regular, undefined, 8,
    );
    return;
  }
  layout.text(
    `El ${methodName} reparte sólo la carga lateral en los nudos. Las acciones siguientes de esta combinación quedan `
    + 'fuera de este análisis: ninguna empuja el pórtico de lado en esta idealización (las vigas llevan su carga a las '
    + 'columnas como fuerzas verticales, y las columnas la transmiten a lo largo de su eje). No se pierden: su efecto se '
    + 'obtiene aparte, con un análisis de cargas verticales —Cross en marcos o el análisis matricial— y se superpone al de '
    + 'esta sección.',
    8.3, layout.fonts.regular, undefined, 8,
  );
  layout.bullets(GROUPS.flatMap(({ kind, label }) => {
    const actions = excluded.filter((action) => action.kind === kind);
    if (!actions.length) return [];
    if (kind === 'self-weight') return [`${label}: ${actions.map((action) => `factor ${number(action.factor, 4)}`).join(', ')}.`];
    return [`${label}: ${actions.map(describe).join('; ')}.`];
  }));
  layout.text(
    'Por eso cortantes, momentos y axiales de las tablas siguientes son sólo los de la carga lateral; los de la '
    + 'combinación completa son su suma con los del análisis vertical.',
    8.3, layout.fonts.bold, layout.palette.ink, 8,
  );
};
