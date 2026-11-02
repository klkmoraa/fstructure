/**
 * Lo que dio el análisis: reacciones y desplazamientos de cada nudo y, por barra, sus extremos
 * de N, V y M, las fuerzas en sus extremos y los puntos críticos. Las funciones de cada tramo
 * se escriben una sola vez, en «Cálculo por miembro y por tramo».
 */
import { clearCell, clearNumber, displayCell, unitFor } from './pdfFormat';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

const QUANTITY: Record<string, string> = { axial: 'N axial', shear: 'V cortante', moment: 'M momento' };
const KIND: Record<string, string> = { end: 'extremo', zero: 'cero', maximum: 'máximo', minimum: 'mínimo' };

export const drawResultsPart = (context: ReportContext): void => {
  const { layout, project, analysis } = context;

  layout.part(
    'Anexo C · Resultados por nudo y por barra',
    'Reacciones, desplazamientos y el detalle de cada barra.',
  );

  layout.heading('Reacciones y desplazamientos');
  if (!analysis.nodeResults.length) {
    layout.note('El análisis no dio resultados por nudo.');
  } else {
    // Each family collapses against its own governing magnitude across the model, so a
    // displacement of 1e-37 m reads as 0 instead of as a measurable movement.
    const extreme = (pick: (entry: typeof analysis.nodeResults[number]) => number) =>
      Math.max(1e-12, ...analysis.nodeResults.map((entry) => Math.abs(pick(entry))));
    const reactionScale = Math.max(extreme((entry) => entry.rx), extreme((entry) => entry.ry));
    const nodalMomentScale = extreme((entry) => entry.rm);
    const displacementScale = Math.max(extreme((entry) => entry.ux), extreme((entry) => entry.uy));
    const rotationScale = extreme((entry) => entry.rz);
    layout.table(
      [
        { header: 'Nudo', width: 54 },
        { header: `R_x (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `R_y (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M (${unitFor(project, 'moment')})`, ...NUMERIC },
        { header: `U_x (${unitFor(project, 'length')})`, ...NUMERIC },
        { header: `U_y (${unitFor(project, 'length')})`, ...NUMERIC },
        { header: 'θ_z (rad)', ...NUMERIC },
      ],
      analysis.nodeResults.map((result) => [
        result.nodeId,
        clearCell(project, result.rx, 'force', reactionScale),
        clearCell(project, result.ry, 'force', reactionScale),
        clearCell(project, result.rm, 'moment', nodalMomentScale),
        clearCell(project, result.ux, 'length', displacementScale),
        clearCell(project, result.uy, 'length', displacementScale),
        clearNumber(result.rz, rotationScale),
      ]),
    );
  }

  if (!analysis.memberResults.length) {
    layout.heading('Detalle por barra');
    layout.note('El análisis no dio resultados por barra.');
    return;
  }

  for (const result of analysis.memberResults) {
    layout.heading(`Barra ${result.memberId}`);
    // A beam with no axial load once reported "min = 1.53081e-16 kip" here while page 1
    // correctly reported 0. Both collapse against the governing magnitude of the same member
    // now, so the document cannot contradict itself.
    const forceScale = Math.max(
      Math.abs(result.maxShear), Math.abs(result.minShear),
      Math.abs(result.maxAxial), Math.abs(result.minAxial), 1e-12,
    );
    const momentScale = Math.max(Math.abs(result.maxMoment), Math.abs(result.minMoment), 1e-12);
    const forceText = (value: number) => clearCell(project, value, 'force', forceScale);
    const momentText = (value: number) => clearCell(project, value, 'moment', momentScale);

    layout.table(
      [
        { header: 'Magnitud', width: 140 },
        { header: 'Mínimo', ...NUMERIC },
        { header: 'Máximo', ...NUMERIC },
        { header: 'Unidad', width: 70 },
      ],
      [
        ['N axial', forceText(result.minAxial), forceText(result.maxAxial), unitFor(project, 'force')],
        ['V cortante', forceText(result.minShear), forceText(result.maxShear), unitFor(project, 'force')],
        ['M momento', momentText(result.minMoment), momentText(result.maxMoment), unitFor(project, 'moment')],
      ],
    );

    // `localEndForces` is [Fxi, Fyi, Mi, Fxj, Fyj, Mj] in base units. It used to be printed
    // bare, so the same page stated forces in kip on one line and in kN on the next with no
    // label at all. Each component is converted and labelled by its own column.
    layout.heading('Fuerzas en los extremos, en ejes locales', 3);
    layout.table(
      [
        { header: `F_{x,i} (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `F_{y,i} (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_i (${unitFor(project, 'moment')})`, ...NUMERIC },
        { header: `F_{x,j} (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `F_{y,j} (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_j (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      [result.localEndForces.map((entry, position) => position === 2 || position === 5 ? momentText(entry) : forceText(entry))],
    );

    if (result.criticalPoints.length) {
      layout.heading('Puntos críticos', 3);
      layout.table(
        [
          { header: 'Magnitud', width: 96 },
          { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
          { header: 'Valor', ...NUMERIC },
          { header: 'Unidad', width: 62 },
          { header: 'Tipo', width: 80 },
        ],
        result.criticalPoints.map((point) => [
          QUANTITY[point.quantity] ?? point.quantity,
          displayCell(project, point.x, 'length'),
          point.quantity === 'moment' ? momentText(point.value) : forceText(point.value),
          unitFor(project, point.quantity === 'moment' ? 'moment' : 'force'),
          KIND[point.kind] ?? point.kind,
        ]),
      );
    }

  }
};
