/**
 * Las dos partes que hacen de este documento una memoria de cálculo y no sólo un informe de
 * resultados: los datos generales al principio (qué se calcula, con qué cargas y bajo qué
 * hipótesis) y las conclusiones al final (las cifras que gobiernan, cómo se verificaron y
 * quién firma). El orden completo es el de una memoria de oficina: datos → materiales →
 * análisis → resultados → cálculo por tramo → conclusiones → anexos.
 */
import { classifyStructure } from '../../analysis-methods/structureClassification';
import { resolveNumericQualityState } from '../../engine/reliability';
import type { DiagramQuantity } from '../../types';
import { drawGlobalDcl } from './pdfDiagrams';
import { clearCell, clearNumber, display, unitFor } from './pdfFormat';
import { memoirNote } from './pdfMemoirKit';
import { METHOD_LABEL } from './pdfProcedureSection';
import { SPACE, TYPE } from './pdfTheme';
import type { ReportContext } from './reportContext';

const CATEGORY: Record<string, string> = {
  permanent: 'permanente',
  variable: 'variable',
  accidental: 'accidental',
  seismic: 'sísmica',
  wind: 'viento',
};

const describeStructure = (context: ReportContext): string => {
  const { project } = context;
  const classification = classifyStructure(project);
  const g = classification.indeterminacy;
  const curved = project.members.filter((member) => member.curve).length;
  const [kind, feminine] = ({
    'simple-beam': ['una viga de un claro', true],
    'continuous-beam': ['una viga continua', true],
    frame: [curved ? 'un marco plano con barras curvas' : 'un marco plano', false],
    truss: ['una armadura plana', true],
    other: ['una estructura plana', true],
  } as const)[classification.kind];
  const ending = feminine ? 'a' : 'o';
  const degree = g === 0 ? `isostátic${ending} (g = 0)` : g > 0 ? `hiperestátic${ending} de grado ${g}` : 'un mecanismo (g < 0)';
  return `Es ${kind}, ${degree}.`;
};

/** Parte 1: objeto, tipo de estructura, modelo de cálculo, escenario de carga e hipótesis. */
export const drawGeneralDataPart = (context: ReportContext): void => {
  const { layout, project, analysis, scenarioFactors, options, solutionMethod } = context;
  layout.part('Datos generales', 'Objeto del cálculo, modelo, escenario de carga e hipótesis.');

  layout.heading('Objeto');
  const supports = project.nodes.filter((node) => node.support.type !== 'none').length;
  const frames = project.members.filter((member) => member.type === 'frame').length;
  const trusses = project.members.filter((member) => member.type === 'truss').length;
  const count = (value: number, noun: string) => `${value} ${noun}${value === 1 ? '' : 's'}`;
  const kinds = [frames ? `${frames} de marco` : '', trusses ? `${trusses} de armadura` : ''].filter(Boolean).join(', ');
  memoirNote(context, `Se analiza «${project.name}»: ${count(project.nodes.length, 'nudo')}, ${count(project.members.length, 'barra')}`
    + `${kinds ? ` (${kinds})` : ''} y ${count(supports, 'apoyo')}. ${describeStructure(context)}`);
  memoirNote(context, solutionMethod === 'matrix-stiffness'
    ? 'Las solicitaciones se obtienen por el método matricial de rigidez, desarrollado paso a paso en la parte de análisis.'
    : `Las solicitaciones se obtienen por el método matricial de rigidez; el procedimiento se desarrolla por `
      + `${METHOD_LABEL[solutionMethod]} y se comprueba contra ese análisis.`);

  layout.figure(
    Math.min(240, Math.max(180, layout.contentWidth * 0.44)),
    (rect) => drawGlobalDcl(context, rect, false),
    'Modelo de cálculo: geometría, apoyos y acciones del escenario, ya multiplicadas por sus factores.',
  );

  layout.heading('Escenario de carga');
  memoirNote(context, `Escenario «${options.scenarioName ?? 'análisis activo'}»: cada caso se multiplica por su factor; el peso propio, si se considera, forma parte de su caso.`);
  layout.table([
    { header: 'Caso', width: 64 },
    { header: 'Nombre' },
    { header: 'Tipo', width: 80 },
    { header: 'Peso propio', width: 78, align: 'right' },
    { header: 'Acciones', width: 64, align: 'right' },
    { header: 'Factor', width: 56, align: 'right' },
  ], project.loadCases.map((loadCase) => {
    const actions = project.nodalLoads.filter((load) => load.caseId === loadCase.id).length
      + project.memberLoads.filter((load) => load.caseId === loadCase.id).length;
    return [
      loadCase.id,
      loadCase.name,
      CATEGORY[loadCase.category] ?? loadCase.category,
      loadCase.selfWeightFactor ? `× ${clearNumber(loadCase.selfWeightFactor)}` : 'no',
      String(actions),
      clearNumber(scenarioFactors[loadCase.id] ?? 0),
    ];
  }));

  layout.heading('Hipótesis de cálculo');
  layout.bullets([
    'Análisis estático lineal de primer orden: material elástico lineal y pequeños desplazamientos.',
    'Barras de marco de Euler–Bernoulli con deformación axial; barras de armadura sólo con rigidez axial.',
    'Propiedades (E, A, I) constantes en cada barra; nudos rígidos salvo las rótulas y liberaciones declaradas.',
    'Cargas en el plano de la estructura; no se consideran pandeo, torsión ni efectos fuera del plano.',
    `Análisis ${analysis.success ? 'resuelto sin errores' : 'con incidencias'}; las cifras están en las unidades del proyecto.`,
  ]);
};

const extreme = (context: ReportContext, quantity: DiagramQuantity) => {
  let best: { value: number; memberId: string; x: number } | undefined;
  for (const result of context.analysis.memberResults) {
    for (const point of result.criticalPoints) {
      if (point.quantity !== quantity) continue;
      if (!best || Math.abs(point.value) > Math.abs(best.value)) best = { value: point.value, memberId: result.memberId, x: point.x };
    }
  }
  return best;
};

/** Última parte del cuerpo: cifras que gobiernan, verificación y firma. */
export const drawConclusionsPart = (context: ReportContext, professionalNote: string): void => {
  const { layout, project, analysis, solutionMethod } = context;
  const { palette, fonts } = layout;
  layout.part('Conclusiones', 'Cifras que gobiernan, verificación y alcance.');

  layout.heading('Resultados que gobiernan');
  const rows: string[][] = [];
  const reaction = analysis.nodeResults.reduce<{ value: number; node: string; component: string } | undefined>((best, node) => {
    for (const [component, value] of [['R_x', node.rx], ['R_y', node.ry]] as const) {
      if (!best || Math.abs(value) > Math.abs(best.value)) best = { value, node: node.nodeId, component };
    }
    return best;
  }, undefined);
  if (reaction) rows.push(['Reacción máxima', clearCell(project, reaction.value, 'force', Math.abs(reaction.value)), unitFor(project, 'force'), `${reaction.component} en ${reaction.node}`]);
  const names: Record<DiagramQuantity, string> = { axial: 'Fuerza axial |N| máxima', shear: 'Cortante |V| máximo', moment: 'Momento |M| máximo' };
  for (const quantity of ['axial', 'shear', 'moment'] as const) {
    const found = extreme(context, quantity);
    if (!found || Math.abs(found.value) < 1e-9) continue;
    const unit = quantity === 'moment' ? 'moment' as const : 'force' as const;
    rows.push([names[quantity], clearCell(project, found.value, unit, Math.abs(found.value)), unitFor(project, unit), `barra ${found.memberId}, x = ${display(project, found.x, 'length')}`]);
  }
  const displacement = analysis.nodeResults.reduce<{ value: number; node: string } | undefined>((best, node) => {
    const value = Math.hypot(node.ux, node.uy);
    return !best || value > best.value ? { value, node: node.nodeId } : best;
  }, undefined);
  if (displacement && displacement.value > 0) {
    // Una flecha se lee en milímetros: «1.53 mm», no «0.00153091 m».
    const inMetres = unitFor(project, 'length') === 'm';
    rows.push([
      'Desplazamiento nodal máximo',
      inMetres ? clearNumber(displacement.value * 1000) : clearCell(project, displacement.value, 'length'),
      inMetres ? 'mm' : unitFor(project, 'length'),
      `nudo ${displacement.node}`,
    ]);
  }
  layout.table([
    { header: 'Magnitud' },
    { header: 'Valor', align: 'right', width: 90 },
    { header: 'Unidad', width: 60 },
    { header: 'Dónde', width: 150 },
  ], rows);

  layout.heading('Verificación');
  const quality = resolveNumericQualityState(analysis);
  layout.bullets([
    `Equilibrio global: residuo normalizado ${clearNumber(analysis.equilibrium.normalizedResidual)}; las tres sumas están desarrolladas en «Resultados del análisis».`,
    solutionMethod === 'matrix-stiffness'
      ? 'Procedimiento: método matricial de rigidez, paso a paso en la parte de análisis.'
      : `Procedimiento: ${METHOD_LABEL[solutionMethod]}, comprobado contra el análisis matricial al final de su desarrollo.`,
    `Calidad numérica del análisis matricial: ${{ stable: 'estable', limited: 'limitada', unreliable: 'no confiable', failed: 'fallida', unavailable: 'no disponible' }[quality]} (número de condición ${clearNumber(analysis.conditionEstimate)}).`,
  ]);

  layout.heading('Alcance');
  layout.text(professionalNote, TYPE.small, fonts.regular, palette.inkSoft);

  // Bloque de firma: una memoria se entrega firmada.
  layout.ensure(110);
  layout.gap(6);
  const columns = 2;
  const width = (layout.contentWidth - SPACE * 8) / columns;
  const top = layout.y - 50;
  ['Elaboró', 'Revisó'].forEach((role, index) => {
    const x = layout.margin + index * (width + SPACE * 8);
    layout.page.drawLine({ start: { x, y: top }, end: { x: x + width, y: top }, thickness: 0.6, color: palette.ink });
    layout.page.drawText(role, { x, y: top - TYPE.small - 4, size: TYPE.small, font: fonts.bold, color: palette.inkSoft });
    layout.page.drawText('Nombre, cédula profesional y fecha', { x, y: top - TYPE.small * 2 - 8, size: TYPE.micro, font: fonts.regular, color: palette.inkFaint });
  });
  layout.y = top - TYPE.small * 2 - 20;
};
