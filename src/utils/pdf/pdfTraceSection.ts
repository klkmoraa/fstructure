/**
 * El álgebra ensamblada: grados de libertad, la matriz de rigidez global y la de restricciones,
 * y por cada elemento su transformación, su rigidez local y su contribución a K.
 *
 * Aquí se revisa el cálculo, no la estructura: las entradas se imprimen con la precisión de la
 * matriz, y una matriz más ancha que la página lo dice y remite al adjunto en vez de recortarse.
 */
import { clearNumber, number } from './pdfFormat';
import { dimensionalFigure, dimensionalUnit } from './pdfSubstitution';
import { formulationLabel } from './pdfSummarySection';
import type { PdfTableColumn } from './pdfBuilder';
import type { MatrixTrace } from '../../types';
import type { ReportContext } from './reportContext';

/** Widest matrix that still fits the content width at a legible size. */
const MATRIX_LIMIT = 8;

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

export const drawTracePart = (context: ReportContext): void => {
  const { layout, analysis, project } = context;
  const trace = analysis.educationTrace;
  if (!trace) return;

  layout.part(
    'Anexo D · Traza del sistema resuelto',
    'Grados de libertad, matrices ensambladas y contribución de cada barra.',
  );

  const matrix = (label: string, entry: MatrixTrace, level: 2 | 3 = 2): void => {
    const rows = Math.min(entry.rows, MATRIX_LIMIT);
    const columns = Math.min(entry.columns, MATRIX_LIMIT);
    const values = new Map(entry.entries.map((cell) => [`${cell.row}:${cell.column}`, cell.value]));
    // A stiffness matrix assembled from terms of order 1e5 carries entries of order 1e-13 that
    // are float residue, not stiffness. Collapsing against the matrix's own governing entry
    // keeps that promise at any scale, and matches how the rest of the document reads a number.
    const scale = Math.max(1e-12, ...entry.entries.map((cell) => Math.abs(cell.value)));
    layout.heading(label, level);
    if (entry.rows > rows || entry.columns > columns) {
      layout.note(
        `Vista parcial ${rows} × ${columns} de una matriz ${entry.rows} × ${entry.columns}; `
        + 'el adjunto JSON conserva todas las entradas.',
      );
    }
    layout.table(
      [{ header: 'GDL', width: 48 }, ...entry.columnLabels.slice(0, columns).map((header) => ({ header, ...NUMERIC }))],
      entry.rowLabels.slice(0, rows).map((rowLabel, row) => [
        rowLabel,
        ...Array.from({ length: columns }, (_, column) => {
          const value = values.get(`${row}:${column}`) ?? 0;
          return value === 0 ? '0' : clearNumber(value, scale, 4);
        }),
      ]),
      { size: 6.6 },
    );
  };

  layout.table([
    { header: 'Formulación' },
    { header: 'GDL', ...NUMERIC, width: 50 },
    { header: 'Restringidos', ...NUMERIC, width: 70 },
    { header: `Energía de deformación (${dimensionalUnit(project, 1, 1)})`, ...NUMERIC },
    { header: 'Matrices', width: 70 },
  ], [[
    `${formulationLabel(trace.formulation)} (traza v${trace.schemaVersion})`,
    String(trace.dofs.length),
    String(trace.dofs.filter((dof) => dof.constrained).length),
    dimensionalFigure(project, trace.assembly.strainEnergy, 1, 1),
    trace.assembly.matrixDetail === 'full' ? 'completas' : 'resumidas',
  ]]);

  matrix('Matriz global de rigidez K', trace.assembly.stiffness);
  matrix('Matriz de restricciones C', trace.assembly.constraintMatrix);

  layout.heading('Elementos');
  layout.table([
    { header: 'Barra', width: 54 },
    { header: `L (${dimensionalUnit(project, 0, 1)})`, ...NUMERIC, width: 56 },
    { header: `L bruta (${dimensionalUnit(project, 0, 1)})`, ...NUMERIC, width: 70 },
    { header: 'c', ...NUMERIC, width: 52 },
    { header: 's', ...NUMERIC, width: 52 },
    { header: 'Grados de libertad', flex: 3 },
    { header: 'Liberados', width: 60 },
  ], trace.elements.map((element) => [
    element.memberId,
    dimensionalFigure(project, element.length, 0, 1),
    dimensionalFigure(project, element.grossLength, 0, 1),
    number(element.c, 4),
    number(element.s, 4),
    element.dofLabels.join(', '),
    element.releasedLocalDofs.length ? element.releasedLocalDofs.join(', ') : '—',
  ]));

  for (const element of trace.elements) {
    layout.heading(`Barra ${element.memberId}`, 2);
    matrix('Transformación T', element.transformation, 3);
    matrix('Rigidez local efectiva k^l', element.localStiffnessEffective, 3);
    matrix('Contribución a K', element.globalStiffnessContribution, 3);
  }
};
