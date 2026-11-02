/**
 * El modelo tal como se analizó: escenario, geometría, secciones, apoyos, cada carga con su
 * intervalo e intensidad reales y la auditoría que concilia las cargas declaradas con el
 * vector ensamblado. Es lo que necesita quien quiera repetir el cálculo.
 */
import { drawGlobalDcl } from './pdfDiagrams';
import { memberAxis } from '../../graphics/structureGeometry';
import { clearNumber, displayCell, number, unitFor } from './pdfFormat';
import { memoirNote } from './pdfMemoirKit';
import { dimensionalFigure, dimensionalUnit } from './pdfSubstitution';
import { formulationLabel } from './pdfSummarySection';
import type { PdfTableColumn } from './pdfBuilder';
import type { ReportContext } from './reportContext';
import type { MemberLoad, MemberType, SupportDefinition } from '../../types';

const NUMERIC: Pick<PdfTableColumn, 'align'> = { align: 'right' };

const SUPPORT: Record<SupportDefinition['type'], string> = {
  none: '—', pin: 'articulado', roller: 'rodillo', fixed: 'empotrado', custom: 'restricciones propias',
};
const MEMBER_TYPE: Record<MemberType, string> = { frame: 'marco', truss: 'armadura', rigid: 'rígida' };
const AXES: Record<MemberLoad['coordinateSystem'], string> = { global: 'globales', local: 'locales' };
/** Longitud a la que se refiere la intensidad: la real de la barra o una de sus proyecciones. */
const BASIS: Record<MemberLoad['lengthBasis'], string> = { real: 'real', horizontal: 'horizontal', vertical: 'vertical' };
const SEVERITY: Record<string, string> = { error: 'Error', warning: 'Aviso', info: 'Info' };

export const drawModelPart = (context: ReportContext): void => {
  const { layout, project, analysis, payload, scenarioFactors, index } = context;

  layout.part(
    'Anexo B · Modelo y acciones',
    'Datos de entrada del análisis: geometría, secciones, apoyos, cargas y su auditoría.',
  );

  // These sums are meant to close at zero. Printing one of them as `0` and the next as
  // `-1.06581e-14` says nothing about the structure, only about which float happened to land
  // exactly on zero. They collapse against the applied load; the normalized residual right
  // after keeps the audit trail at full precision.
  const forceScale = Math.max(
    Math.abs(analysis.loadAudit?.source.fx ?? 0),
    Math.abs(analysis.loadAudit?.source.fy ?? 0),
    1,
  );
  const momentScale = Math.max(Math.abs(analysis.loadAudit?.source.mz ?? 0), 1);

  layout.keyValues([
    ['Estado del análisis', analysis.success ? 'resuelto' : 'con errores'],
    ['Modelo', `${project.nodes.length} nudos · ${project.members.length} barras`],
    ['Acciones', `${payload.metadata.loadCount} cargas · ${project.loadCases.length} casos · ${project.combinations.length} combinaciones`],
    ['Factores del escenario', project.loadCases.map((loadCase) => `${loadCase.id} = ${number(scenarioFactors[loadCase.id] ?? 0)}`).join('   ') || 'sin casos'],
    ['Formulación', formulationLabel(analysis.educationTrace?.formulation)],
    ['Expediente adjunto', `v${payload.formatVersion} · aplicación ${payload.provenance.appVersion}`],
    ['Integridad SHA-256', payload.checksum.value],
  ]);

  layout.figure(
    182,
    (rect) => drawGlobalDcl(context, rect),
    'Geometría, apoyos y acciones aplicadas, tal como entran en el análisis.',
  );

  layout.heading('Nudos y apoyos');
  layout.table(
    [
      { header: 'Nudo', width: 62 },
      { header: `x (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: `y (${unitFor(project, 'length')})`, ...NUMERIC },
      { header: 'Apoyo', flex: 1.4 },
      { header: 'Articulación interna', flex: 1.2 },
    ],
    project.nodes.map((node) => [
      node.id,
      displayCell(project, node.x, 'length'),
      displayCell(project, node.y, 'length'),
      SUPPORT[node.support.type],
      node.internalHinge ? 'sí' : '—',
    ]),
  );

  layout.heading('Barras y secciones');
  layout.table(
    [
      { header: 'Barra', width: 62 },
      { header: 'Conexión', width: 78 },
      { header: 'Tipo', width: 56 },
      { header: `E (${dimensionalUnit(project, 1, -2)})`, ...NUMERIC },
      { header: `A (${dimensionalUnit(project, 0, 2)})`, ...NUMERIC },
      { header: `I (${dimensionalUnit(project, 0, 4)})`, ...NUMERIC },
    ],
    project.members.map((member) => [
      member.id,
      `${member.i} → ${member.j}`,
      MEMBER_TYPE[member.type],
      dimensionalFigure(project, member.E, 1, -2),
      dimensionalFigure(project, member.A, 0, 2),
      dimensionalFigure(project, member.I, 0, 4),
    ]),
  );

  layout.heading('Cargas nodales');
  if (!project.nodalLoads.length) {
    layout.note('El modelo no lleva cargas nodales.');
  } else {
    layout.table(
      [
        { header: 'Carga', width: 58 },
        { header: 'Nudo', width: 48 },
        { header: 'Caso', width: 54 },
        { header: 'Factor', ...NUMERIC, width: 46 },
        { header: `F_x (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `F_y (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_z (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      project.nodalLoads.map((load) => [
        load.id,
        load.nodeId,
        load.caseId,
        number(scenarioFactors[load.caseId] ?? 0),
        displayCell(project, load.fx, 'force'),
        displayCell(project, load.fy, 'force'),
        displayCell(project, load.mz, 'moment'),
      ]),
    );
  }

  layout.heading('Cargas en barras');
  if (!project.memberLoads.length) {
    layout.note('El modelo no lleva cargas en barras.');
  } else {
    const lengthUnit = unitFor(project, 'length');
    const forceUnit = unitFor(project, 'force');
    const intensityUnit = dimensionalUnit(project, 1, -1);
    const spanOf = (load: MemberLoad) => {
      const member = index.member(load.memberId);
      const i = member ? index.node(member.i) : undefined;
      const j = member ? index.node(member.j) : undefined;
      return member && i && j ? memberAxis(member, i, j).flexibleLength : 0;
    };
    const common = (load: MemberLoad) => [load.id, load.memberId, load.caseId, number(scenarioFactors[load.caseId] ?? 0), AXES[load.coordinateSystem]];
    const commonColumns: PdfTableColumn[] = [
      { header: 'Carga', width: 54 },
      { header: 'Barra', width: 40 },
      { header: 'Caso', width: 34 },
      { header: 'Factor', ...NUMERIC, width: 38 },
      { header: 'Ejes', width: 46 },
    ];
    const distributed = project.memberLoads.filter((load) => load.type === 'distributed');
    if (distributed.length) {
      layout.heading('Distribuidas', 3);
      const withAxial = distributed.some((load) => (load.qxStart ?? 0) !== 0 || (load.qxEnd ?? 0) !== 0);
      layout.table([
        ...commonColumns,
        { header: 'Longitud', width: 54 },
        { header: `a (${lengthUnit})`, ...NUMERIC, width: 40 },
        { header: `b (${lengthUnit})`, ...NUMERIC, width: 40 },
        ...(withAxial ? [{ header: `q_{x,a} (${intensityUnit})`, ...NUMERIC }, { header: `q_{x,b} (${intensityUnit})`, ...NUMERIC }] : []),
        { header: `q_{y,a} (${intensityUnit})`, ...NUMERIC },
        { header: `q_{y,b} (${intensityUnit})`, ...NUMERIC },
      ], distributed.map((load) => {
        const span = spanOf(load);
        return [
          ...common(load),
          BASIS[load.lengthBasis],
          dimensionalFigure(project, Math.min(load.start, load.end) * span, 0, 1),
          dimensionalFigure(project, Math.max(load.start, load.end) * span, 0, 1),
          ...(withAxial ? [dimensionalFigure(project, load.qxStart ?? 0, 1, -1), dimensionalFigure(project, load.qxEnd ?? load.qxStart ?? 0, 1, -1)] : []),
          dimensionalFigure(project, load.qyStart ?? 0, 1, -1),
          dimensionalFigure(project, load.qyEnd ?? load.qyStart ?? 0, 1, -1),
        ];
      }));
    }
    const point = project.memberLoads.filter((load) => load.type === 'point');
    if (point.length) {
      layout.heading('Puntuales', 3);
      layout.table([
        ...commonColumns,
        { header: `x (${lengthUnit})`, ...NUMERIC },
        { header: `P_x (${forceUnit})`, ...NUMERIC },
        { header: `P_y (${forceUnit})`, ...NUMERIC },
      ], point.map((load) => [
        ...common(load),
        dimensionalFigure(project, Math.min(1, Math.max(0, load.position ?? 0.5)) * spanOf(load), 0, 1),
        dimensionalFigure(project, load.px ?? 0, 1, 0),
        dimensionalFigure(project, load.py ?? 0, 1, 0),
      ]));
    }
    const moments = project.memberLoads.filter((load) => load.type === 'moment');
    if (moments.length) {
      layout.heading('Momentos', 3);
      layout.table([
        ...commonColumns,
        { header: `x (${lengthUnit})`, ...NUMERIC },
        { header: `M (${dimensionalUnit(project, 1, 1)})`, ...NUMERIC },
      ], moments.map((load) => [
        ...common(load),
        dimensionalFigure(project, Math.min(1, Math.max(0, load.position ?? 0.5)) * spanOf(load), 0, 1),
        dimensionalFigure(project, load.moment ?? 0, 1, 1),
      ]));
    }
  }

  const audit = analysis.loadAudit;
  if (audit) {
    layout.heading('Auditoría independiente de cargas');
    memoirNote(context, 'Resultante de las cargas por dos vías independientes: las cargas declaradas y el vector nodal ensamblado. Deben coincidir.');
    layout.table(
      [
        { header: 'Ruta', width: 110 },
        { header: `F_x (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `F_y (${unitFor(project, 'force')})`, ...NUMERIC },
        { header: `M_O (${unitFor(project, 'moment')})`, ...NUMERIC },
      ],
      [
        ['Cargas declaradas', clearNumber(audit.source.fx, forceScale), clearNumber(audit.source.fy, forceScale), clearNumber(audit.source.mz, momentScale)],
        ['Vector ensamblado', clearNumber(audit.assembled.fx, forceScale), clearNumber(audit.assembled.fy, forceScale), clearNumber(audit.assembled.mz, momentScale)],
      ],
    );
    const reference = audit.referencePoint;
    const critical = audit.memberAudits.reduce<typeof audit.memberAudits[number] | undefined>(
      (best, entry) => !best || entry.normalizedResidual > best.normalizedResidual ? entry : best,
      undefined,
    );
    layout.table([
      { header: `Punto O (${unitFor(project, 'length')})` },
      { header: 'Residuo de resultantes', ...NUMERIC },
      { header: 'Residuo máximo', ...NUMERIC },
      { header: 'En la barra', width: 90 },
    ], [[
      reference ? `(${displayCell(project, reference.x, 'length')}, ${displayCell(project, reference.y, 'length')})` : '—',
      clearNumber(audit.resultantResidual),
      clearNumber(audit.normalizedResidual),
      critical?.memberId ?? '—',
    ]]);

    if (audit.memberAudits.length) {
      layout.heading('Reintegración por trabajo virtual, barra a barra', 2);
      memoirNote(context, 'Vector local de cada barra reintegrado desde las cargas declaradas, antes de liberar extremos.');
      layout.table(
        [
          { header: 'Barra', width: 66 },
          { header: `L declarada (${unitFor(project, 'length')})`, ...NUMERIC },
          { header: `L ensamblada (${unitFor(project, 'length')})`, ...NUMERIC },
          { header: 'Residuo mecánico', ...NUMERIC },
          { header: 'Residuo inicial', ...NUMERIC },
          { header: 'Residuo total', ...NUMERIC },
        ],
        audit.memberAudits.map((entry) => [
          entry.memberId,
          displayCell(project, entry.flexibleLength.source, 'length'),
          displayCell(project, entry.flexibleLength.assembled, 'length'),
          clearNumber(entry.mechanical.normalizedResidual),
          clearNumber(entry.initial.normalizedResidual),
          clearNumber(entry.normalizedResidual),
        ]),
      );
    }
  }

  if (analysis.issues.length) {
    layout.heading('Incidencias registradas');
    layout.table(
      [{ header: 'Severidad', width: 70 }, { header: 'Título', width: 130 }, { header: 'Detalle', flex: 3 }],
      analysis.issues.map((issue) => [SEVERITY[issue.severity] ?? issue.severity, issue.title, issue.message]),
    );
  }
};
