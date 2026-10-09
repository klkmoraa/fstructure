import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import { designColumn, type ColumnDesignInput } from '../../../design/elements/column';
import { REBAR_SIZES } from '../../../design/elements/shared';
import { mpaFromKgcm2, parseNumber } from './formNumbers';

export const COLUMN_DEFAULTS = {
  tag: '', place: '',
  shape: 'rectangular', diameter: '45', barCount: '8', transverse: 'ties',
  width: '40', depth: '40', cover: '4', fc: '250', fy: '4200', bar: '19.1', barsWidth: '3', barsDepth: '3', tie: '9.5',
  tieSpacing: '', endTieSpacing: '',
  axial: '900', momentX: '80', momentY: '40', shearX: '0', shearY: '0', length: '3', k: '1', curvature: 'single', endRatio: '1', sustained: '0.6',
  group: 'B2', groundFloor: 'no', aggregate: '19', braced: 'yes', swayX: '0', swayY: '0', stability: '0.05',
};
export type ColumnDraft = typeof COLUMN_DEFAULTS;

export const circularDraft = (draft: ColumnDraft) => draft.shape === 'circular';

export const columnToInput = (codeId: DesignCodeId, draft: ColumnDraft): ColumnDesignInput => ({
  code: codeId,
  shape: circularDraft(draft) ? 'circular' : 'rectangular',
  widthMm: parseNumber(circularDraft(draft) ? draft.diameter : draft.width) * 10,
  depthMm: parseNumber(circularDraft(draft) ? draft.diameter : draft.depth) * 10,
  barCount: parseNumber(draft.barCount),
  transverse: circularDraft(draft) && draft.transverse === 'spiral' && designCode(codeId).column.spiral ? 'spiral' : 'ties',
  coverMm: parseNumber(draft.cover) * 10,
  fcMpa: mpaFromKgcm2(draft.fc),
  fyMpa: mpaFromKgcm2(draft.fy),
  barDiameterMm: parseNumber(draft.bar),
  barsAlongWidth: parseNumber(draft.barsWidth),
  barsAlongDepth: parseNumber(draft.barsDepth),
  tieDiameterMm: parseNumber(draft.tie),
  ...(draft.tieSpacing.trim() ? { tieSpacingMm: parseNumber(draft.tieSpacing) * 10 } : {}),
  ...(!isSpiralDraft(codeId, draft) && designCode(codeId).column.ties === 'ntc' && draft.endTieSpacing.trim()
    ? { endTieSpacingMm: parseNumber(draft.endTieSpacing) * 10 } : {}),
  maxAggregateMm: parseNumber(draft.aggregate),
  axialKn: parseNumber(draft.axial),
  momentXKnm: parseNumber(draft.momentX),
  momentYKnm: parseNumber(draft.momentY),
  unbracedLengthM: parseNumber(draft.length),
  effectiveLengthFactor: parseNumber(draft.k),
  curvature: draft.curvature === 'double' ? 'double' : 'single',
  endMomentRatio: parseNumber(draft.endRatio),
  shearXKn: parseNumber(draft.shearX),
  shearYKn: parseNumber(draft.shearY),
  group: draft.group === 'A' || draft.group === 'B1' ? draft.group : 'B2',
  groundFloor: draft.groundFloor === 'yes',
  sustainedRatio: parseNumber(draft.sustained),
  braced: draft.braced !== 'no',
  swayMomentXKnm: draft.braced === 'no' ? parseNumber(draft.swayX) : 0,
  swayMomentYKnm: draft.braced === 'no' ? parseNumber(draft.swayY) : 0,
  stabilityIndex: draft.braced === 'no' ? parseNumber(draft.stability) : 0,
});

const isSpiralDraft = (codeId: DesignCodeId, draft: ColumnDraft) => circularDraft(draft) && draft.transverse === 'spiral' && designCode(codeId).column.spiral !== null;
const PROPOSED_REINFORCEMENT_BARS = REBAR_SIZES.filter(({ diameterMm }) => diameterMm >= 12.7).map(({ diameterMm }) => diameterMm);

export function proposeColumnReinforcement(codeId: DesignCodeId, draft: ColumnDraft): Partial<ColumnDraft> | null {
  const actions = [draft.axial, draft.momentX, draft.momentY, draft.shearX, draft.shearY, draft.swayX, draft.swayY, draft.stability];
  if (actions.some((value) => !Number.isFinite(parseNumber(value)))) return null;

  const circular = circularDraft(draft);
  const rules = designCode(codeId).column;
  const capturedTie = parseNumber(draft.tie);
  let best: { readonly fields: Partial<ColumnDraft>; readonly steelAreaMm2: number } | null = null;
  const counts = circular
    ? Array.from({ length: 27 }, (_, index) => index + 4)
    : Array.from({ length: 11 }, (_, index) => index + 2);
  const widthCounts = counts;
  const depthCounts = circular ? [2] : counts;

  for (const bar of PROPOSED_REINFORCEMENT_BARS) {
    const tie = Math.max(Number.isFinite(capturedTie) ? capturedTie : 0, rules.minimumTieDiameter(bar));
    for (const widthCount of widthCounts) {
      for (const depthCount of depthCounts) {
        const fields: Partial<ColumnDraft> = circular
          ? { bar: String(bar), barCount: String(widthCount), ...(tie !== capturedTie ? { tie: String(tie) } : {}) }
          : { bar: String(bar), barsWidth: String(widthCount), barsDepth: String(depthCount), ...(tie !== capturedTie ? { tie: String(tie) } : {}) };
        const trial = designColumn(columnToInput(codeId, { ...draft, ...fields }));
        if (!trial.ok || trial.status === 'fail') continue;
        if (!best || trial.steelAreaMm2 < best.steelAreaMm2) best = { fields, steelAreaMm2: trial.steelAreaMm2 };
      }
    }
  }
  return best?.fields ?? null;
}
