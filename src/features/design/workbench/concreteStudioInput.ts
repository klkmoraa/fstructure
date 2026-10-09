import type { SectionStudioInput } from '../../../design/concrete/sectionStudio';
import { mpaFromKgcm2, parseNumber } from './formNumbers';

export const SECTION_DEFAULTS = {
  tag: '', place: '', preset: 'column', level: 'simple',
  shape: 'square', width: '40', height: '40', cover: '4',
  fc: '250', fy: '4200', bar: '19.1', barCount: '8', barLayout: 'perimeter', topBarCount: '2', bottomBarCount: '4', cornerBarCount: '1', faceBarCount: '1',
  tie: '9.5', tieType: 'closed', tieSpacing: '15', length: '3',
  philosophy: 'ultimate', demandBasis: 'factored', loadFactor: '1.4',
  axial: '900', moment: '80', shear: '0', angle: '0',
  phi: '0.75', gammaConcrete: '1.5', gammaSteel: '1.15', allowableConcrete: '0.45', allowableSteel: '0.6',
};
export type SectionDraft = typeof SECTION_DEFAULTS;

export const SECTION_SHAPES = [
  { value: 'square', label: 'Cuadrada' }, { value: 'rectangle', label: 'Rectangular' },
  { value: 'circle', label: 'Circular' }, { value: 'octagon', label: 'Octagonal' },
  { value: 'hexagon', label: 'Hexagonal' }, { value: 'triangle', label: 'Triangular' },
] as const;
export const SECTION_PHILOSOPHIES = [
  { value: 'allowable', short: 'EA', label: 'Esfuerzos admisibles', description: 'Esfuerzos elásticos en sección fisurada; solicitaciones de servicio.' },
  { value: 'ultimate', short: 'RU', label: 'Resistencia última', description: 'Resistencia nominal con φ; solicitaciones últimas.' },
  { value: 'limit-state', short: 'EL', label: 'Estados límite', description: 'Resistencias fc/γc y fy/γs; servicio sin evaluar.' },
] as const;

export const sectionPhilosophy = (draft: SectionDraft) => SECTION_PHILOSOPHIES.find((item) => item.value === draft.philosophy) ?? SECTION_PHILOSOPHIES[1];

/** Adapta el snapshot serializable al motor sin cargar código de interfaz. */
export const sectionInput = (draft: SectionDraft): SectionStudioInput => {
  const philosophy = sectionPhilosophy(draft).value;
  const factor = philosophy !== 'allowable' && draft.demandBasis === 'service' ? parseNumber(draft.loadFactor) : 1;
  return {
    shape: SECTION_SHAPES.find((item) => item.value === draft.shape)?.value ?? 'square',
    philosophy,
    widthMm: parseNumber(draft.width) * 10,
    heightMm: parseNumber(draft.height) * 10,
    coverMm: parseNumber(draft.cover) * 10,
    fcMpa: mpaFromKgcm2(draft.fc), fyMpa: mpaFromKgcm2(draft.fy),
    barDiameterMm: parseNumber(draft.bar), barCount: draft.barLayout === 'zones' ? 4 * (parseNumber(draft.cornerBarCount) + parseNumber(draft.faceBarCount)) : parseNumber(draft.barCount),
    barLayout: draft.barLayout === 'layers' ? 'layers' : draft.barLayout === 'zones' ? 'zones' : 'perimeter',
    topBarCount: parseNumber(draft.topBarCount), bottomBarCount: parseNumber(draft.bottomBarCount),
    cornerBarCount: parseNumber(draft.cornerBarCount), faceBarCount: parseNumber(draft.faceBarCount),
    tieDiameterMm: parseNumber(draft.tie),
    tieType: draft.tieType === 'spiral' ? 'spiral' : draft.tieType === 'cross-tie' ? 'cross-tie' : 'closed',
    tieSpacingMm: parseNumber(draft.tieSpacing) * 10,
    lengthM: parseNumber(draft.length),
    axialKn: parseNumber(draft.axial) * factor, momentKnm: parseNumber(draft.moment) * factor, shearKn: parseNumber(draft.shear) * factor,
    angleDeg: parseNumber(draft.angle), phi: parseNumber(draft.phi),
    gammaConcrete: parseNumber(draft.gammaConcrete), gammaSteel: parseNumber(draft.gammaSteel),
    allowableConcreteRatio: parseNumber(draft.allowableConcrete), allowableSteelRatio: parseNumber(draft.allowableSteel),
  };
};
