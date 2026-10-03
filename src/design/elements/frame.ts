import { analyzeFrame, memberActionAt, type FrameLoadCase, type FrameMember, type FrameModel } from '../frame/frameAnalysis';
import { designCode, isDesignCodeId, type DesignCodeId, type LoadCombination } from './codes';
import type { ColumnGroup } from './column';
import { CONCRETE_UNIT_WEIGHT_KN_M3, isPositiveFinite, type ClauseReference } from './shared';
import {
  designStructure, probeLoads,
  type StructureCase, type StructureColumnReinforcement, type StructureDesignResult, type StructureMember, type StructureNode, type StructureSection, type StructureSource,
} from './structure';

export { swayEffectiveLengthFactor } from './structure';

/**
 * Pórtico regular que genera el taller: claros y niveles con secciones únicas
 * de viga y columna. Este módulo sólo **genera** la estructura —nudos,
 * miembros y casos de carga— y la resuelve con `analyzeFrame` (rigidez directa,
 * validada contra el solver 2D). El diseño de vigas y columnas es el común de
 * `structure.ts`, el mismo que recibe un Modelo 2D.
 *
 * Casos: la carga muerta (con el peso propio) y la viva de cada claro de cada
 * nivel por separado, el peso propio de las columnas, la acción lateral
 * repartida entre los nudos de cada nivel y el caso de sondeo.
 */

export const MAX_FRAME_BAYS = 5;
export const MAX_FRAME_STORIES = 5;

export interface FrameStory {
  readonly heightM: number;
  /** Carga de servicio sobre las vigas del nivel, kN/m, sin peso propio. */
  readonly deadKnPerM: number;
  readonly liveKnPerM: number;
  /** Fuerza lateral de diseño en el nivel (sismo ya reducido o viento), kN. */
  readonly lateralKn: number;
}

export type FrameSection = StructureSection;
export type FrameColumnReinforcement = StructureColumnReinforcement;

export interface FrameDesignInput {
  readonly code: DesignCodeId;
  /** Claros entre ejes de columnas, m. */
  readonly bays: readonly number[];
  /** Niveles de abajo hacia arriba. */
  readonly stories: readonly FrameStory[];
  readonly base: 'fixed' | 'pinned';
  /** Marco arriostrado: cada nivel restringido lateralmente por otro sistema (muros, contravientos). */
  readonly braced: boolean;
  readonly beam: FrameSection;
  readonly column: FrameSection;
  /** Recubrimiento libre hasta el estribo, el mismo en vigas y columnas. */
  readonly coverMm: number;
  readonly fcMpa: number;
  readonly fyMpa: number;
  readonly fyStirrupMpa: number;
  readonly maxAggregateMm: number;
  readonly includeSelfWeight: boolean;
  /** Combinaciones gravitacionales de la norma. */
  readonly combinations: readonly LoadCombination[];
  /** Combinaciones con acción lateral; se usan si algún nivel tiene fuerza lateral. */
  readonly lateralCombinations: readonly LoadCombination[];
  readonly lateralReference?: ClauseReference;
  readonly sustainedLiveRatio: number;
  readonly longTermXi: number;
  readonly damagesNonstructural: boolean;
  /** `null` elige el diámetro de las vigas automáticamente. */
  readonly beamBarDiameterMm: number | null;
  readonly stirrupDiameterMm: number | null;
  readonly columnReinforcement: FrameColumnReinforcement;
  readonly group: ColumnGroup;
  /** Factores sobre la inercia bruta para el análisis (1 = sección bruta). */
  readonly beamInertiaFactor: number;
  readonly columnInertiaFactor: number;
  /** k propio de las columnas; `null`: 1.0 si el marco está arriostrado y el del nomograma si no. */
  readonly effectiveLengthFactor: number | null;
}

export type FrameDesignResult = StructureDesignResult & {
  readonly input: FrameDesignInput;
  readonly selfWeight: { readonly beamKnPerM: number; readonly columnKnPerM: number };
};

interface FrameDesignError { readonly ok: false; readonly errors: readonly string[] }

function validate(input: FrameDesignInput): string[] {
  const errors: string[] = [];
  if (!isDesignCodeId(input.code)) return ['Norma de diseño desconocida.'];
  if (input.bays.length < 1 || input.bays.length > MAX_FRAME_BAYS) errors.push(`El pórtico debe tener entre 1 y ${MAX_FRAME_BAYS} claros.`);
  if (input.stories.length < 1 || input.stories.length > MAX_FRAME_STORIES) errors.push(`El pórtico debe tener entre 1 y ${MAX_FRAME_STORIES} niveles.`);
  input.bays.forEach((length, index) => { if (!isPositiveFinite(length)) errors.push(`Claro ${index + 1}: la longitud debe ser mayor que cero.`); });
  input.stories.forEach((story, index) => {
    if (!isPositiveFinite(story.heightM)) errors.push(`Nivel ${index + 1}: la altura debe ser mayor que cero.`);
    for (const [key, label] of [['deadKnPerM', 'carga muerta'], ['liveKnPerM', 'carga viva'], ['lateralKn', 'fuerza lateral']] as const) {
      if (!Number.isFinite(story[key]) || story[key] < 0) errors.push(`Nivel ${index + 1}: la ${label} debe ser cero o positiva.`);
    }
  });
  const positive: [number, string][] = [
    [input.beam.widthMm, 'Base de la viga'], [input.beam.heightMm, 'Peralte de la viga'],
    [input.column.widthMm, 'Base b de la columna'], [input.column.heightMm, 'Peralte h de la columna'],
    [input.coverMm, 'Recubrimiento'], [input.fcMpa, "f'c"], [input.fyMpa, 'fy'], [input.fyStirrupMpa, 'fy de estribos'],
    [input.maxAggregateMm, 'Agregado máximo'], [input.beamInertiaFactor, 'Factor de inercia de vigas'], [input.columnInertiaFactor, 'Factor de inercia de columnas'],
  ];
  for (const [value, label] of positive) if (!isPositiveFinite(value)) errors.push(`${label} debe ser mayor que cero.`);
  if (input.beamInertiaFactor > 1 || input.columnInertiaFactor > 1) errors.push('Los factores de inercia van de 0 a 1.');
  if (input.effectiveLengthFactor !== null && !isPositiveFinite(input.effectiveLengthFactor)) errors.push('El factor k propio debe ser mayor que cero.');
  if (input.combinations.length < 1) errors.push('Se requiere al menos una combinación de carga.');
  if (errors.length) return errors;
  const shortest = Math.min(...input.stories.map((story) => story.heightM));
  if (shortest * 1e3 <= input.beam.heightMm + 100) errors.push('La altura de entrepiso no deja altura libre a las columnas con ese peralte de viga.');
  return errors;
}

const sectionInertia = (section: FrameSection) => section.widthMm * section.heightMm ** 3 / 12 / 1e12;
const sectionArea = (section: FrameSection) => section.widthMm * section.heightMm / 1e6;

/** Fuente de diseño del pórtico generado: geometría, casos y su análisis rápido. */
export function frameSource(input: FrameDesignInput): StructureSource & { readonly selfWeight: FrameDesignResult['selfWeight'] } {
  const lines = input.bays.length + 1;
  const xs = [0];
  input.bays.forEach((length) => xs.push(xs[xs.length - 1]! + length));
  const ys = [0];
  input.stories.forEach((story) => ys.push(ys[ys.length - 1]! + story.heightM));
  const node = (line: number, level: number) => level * lines + line;
  const e = designCode(input.code).elasticModulusMpa(input.fcMpa) * 1e3;
  const columnInertia = sectionInertia(input.column) * input.columnInertiaFactor;
  const beamInertia = sectionInertia(input.beam) * input.beamInertiaFactor;
  const nodes: StructureNode[] = ys.flatMap((y, level) => xs.map((x) => ({ x, y, support: level === 0 ? (input.base === 'fixed' ? 'fixed' : 'pinned') : 'free' })));
  const members: StructureMember[] = [];
  const frameMembers: FrameMember[] = [];
  input.stories.forEach((_, story) => {
    for (let line = 0; line < lines; line += 1) {
      members.push({
        id: `C${line + 1}-${story + 1}`, label: `C${line + 1}·N${story + 1}`, i: node(line, story), j: node(line, story + 1), kind: 'column',
        section: input.column, flexuralStiffnessKnM2: e * columnInertia, displayDeadKnPerM: 0, displayLiveKnPerM: 0,
      });
      frameMembers.push({ i: node(line, story), j: node(line, story + 1), elasticModulusKpa: e, areaM2: sectionArea(input.column), inertiaM4: columnInertia });
    }
  });
  input.stories.forEach((story, s) => {
    input.bays.forEach((__, bay) => {
      members.push({
        id: `V${s + 1}-${bay + 1}`, label: `V${s + 1}·${bay + 1}`, i: node(bay, s + 1), j: node(bay + 1, s + 1), kind: 'beam',
        section: input.beam, flexuralStiffnessKnM2: e * beamInertia, displayDeadKnPerM: story.deadKnPerM, displayLiveKnPerM: story.liveKnPerM,
      });
      frameMembers.push({ i: node(bay, s + 1), j: node(bay + 1, s + 1), elasticModulusKpa: e, areaM2: sectionArea(input.beam), inertiaM4: beamInertia });
    });
  });
  const selfWeight = input.includeSelfWeight
    ? { beamKnPerM: CONCRETE_UNIT_WEIGHT_KN_M3 * sectionArea(input.beam), columnKnPerM: CONCRETE_UNIT_WEIGHT_KN_M3 * sectionArea(input.column) }
    : { beamKnPerM: 0, columnKnPerM: 0 };
  const lateral = !input.braced && input.stories.some((story) => story.lateralKn > 0);

  const cases: StructureCase[] = [];
  const loads: FrameLoadCase[] = [];
  members.forEach((member, index) => {
    if (member.kind !== 'beam') return;
    cases.push({ id: `D-${member.id}`, label: `CM ${member.label}`, kind: 'dead' });
    loads.push({ id: `D-${member.id}`, gravity: { [index]: member.displayDeadKnPerM + selfWeight.beamKnPerM } });
    cases.push({ id: `L-${member.id}`, label: `CV ${member.label}`, kind: 'live' });
    loads.push({ id: `L-${member.id}`, gravity: { [index]: member.displayLiveKnPerM } });
  });
  if (selfWeight.columnKnPerM > 0) {
    cases.push({ id: 'D-col', label: 'Peso propio de columnas', kind: 'dead' });
    loads.push({ id: 'D-col', gravity: Object.fromEntries(members.flatMap((member, index) => member.kind === 'column' ? [[index, selfWeight.columnKnPerM]] : [])) });
  }
  // Fuerza de cada nivel repartida entre sus nudos (diafragma rígido).
  if (lateral) {
    cases.push({ id: 'E', label: 'Acción lateral', kind: 'lateral' });
    loads.push({ id: 'E', nodal: input.stories.flatMap((story, s) => xs.map((__, line) => ({ node: node(line, s + 1), fx: story.lateralKn / lines, fy: 0 }))) });
  }
  if (!input.braced) {
    cases.push({ id: 'probe', label: 'Sondeo lateral', kind: 'probe' });
    loads.push({ id: 'probe', nodal: probeLoads(nodes, members).map((item) => ({ ...item, fy: 0 })) });
  }

  return {
    kind: 'frame',
    label: `Pórtico ${input.bays.length} ${input.bays.length === 1 ? 'claro' : 'claros'} × ${input.stories.length} ${input.stories.length === 1 ? 'nivel' : 'niveles'}`,
    nodes,
    members,
    cases,
    braced: input.braced,
    selfWeight,
    lateralLevels: lateral ? input.stories.map((story, s) => ({ y: ys[s + 1]!, kN: story.lateralKn })) : [],
    analyze(overrides) {
      const model: FrameModel = {
        nodes: nodes.map((item, index) => ({
          x: item.x,
          y: item.y,
          restraint: item.support === 'fixed' ? [true, true, true] as const
            : item.support === 'pinned' ? [true, true, false] as const
              // Arriostrado: el primer nudo de cada nivel no se desplaza lateralmente.
              : [input.braced && index % lines === 0, false, false] as const,
        })),
        members: frameMembers.map((member, index) => overrides?.has(index) ? { ...member, inertiaM4: overrides.get(index)! } : member),
      };
      const outcome = analyzeFrame(model, loads);
      if (!outcome.ok) return outcome;
      return {
        ok: true,
        cases: outcome.analysis.cases.map((caseResult) => ({
          nodeDisplacements: caseResult.nodeDisplacements,
          at: (memberIndex: number, x: number) => memberActionAt(model.members[memberIndex]!, outcome.analysis.geometry[memberIndex]!.lengthM, caseResult.members[memberIndex]!, x),
        })),
      };
    },
  };
}

export function designFrame(input: FrameDesignInput): FrameDesignResult | FrameDesignError {
  const errors = validate(input);
  if (errors.length) return { ok: false, errors };
  const source = frameSource(input);
  const result = designStructure(source, {
    code: input.code,
    coverMm: input.coverMm,
    fcMpa: input.fcMpa,
    fyMpa: input.fyMpa,
    fyStirrupMpa: input.fyStirrupMpa,
    maxAggregateMm: input.maxAggregateMm,
    includeSelfWeight: input.includeSelfWeight,
    combinations: input.combinations,
    lateralCombinations: input.lateralCombinations,
    ...(input.lateralReference ? { lateralReference: input.lateralReference } : {}),
    sustainedLiveRatio: input.sustainedLiveRatio,
    longTermXi: input.longTermXi,
    damagesNonstructural: input.damagesNonstructural,
    beamBarDiameterMm: input.beamBarDiameterMm,
    stirrupDiameterMm: input.stirrupDiameterMm,
    columnReinforcement: input.columnReinforcement,
    group: input.group,
    effectiveLengthFactor: input.effectiveLengthFactor,
  });
  if (!result.ok) return result;
  return { ...result, input, selfWeight: source.selfWeight };
}
