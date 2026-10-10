import { designBeam } from '../../../design/elements/beam';
import type { DesignCodeId } from '../../../design/elements/codes';
import { parseNumber } from './formNumbers';
import { beamToInput } from './beamInput';
import { parseBeamDetails } from './beamDetailInput';
import type { BeamDetailDraft } from './beamDetailDraft';
import type { BeamDraft, SpanDraft } from './beamModel';

const WIDTHS_CM = [20, 25, 30, 35, 40, 45, 50];

/** Existing bounded geometry search, now callable only from the proposal worker in the UI path. */
export function proposeBeamSectionCompute(codeId: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[], details?: BeamDetailDraft): { width: string; height: string } | null {
  if (details) {
    const physical = parseBeamDetails(details, spans);
    if (physical.errors.length || (physical.bastions.length && (draft.rebarMode !== 'own' || draft.ownBastions !== 'custom'))
      || (physical.stirrupZones.some(Boolean) && draft.rebarMode !== 'own')) return null;
  }
  const longest = Math.max(...spans.map((span) => parseNumber(span.length)).filter(Number.isFinite), 0);
  if (!(longest > 0)) return null;
  const start = Math.max(30, Math.ceil(longest * 100 / 16 / 5) * 5);
  let best: { width: number; height: number } | null = null;
  for (const width of WIDTHS_CM) {
    for (let height = Math.max(start, width); height <= Math.min(150, 3 * width); height += 5) {
      if (best && width * height >= best.width * best.height) break;
      const trial = designBeam(beamToInput(codeId, { ...draft, width: String(width), height: String(height) }, spans, draft.rebarMode === 'own', details));
      if (trial.ok && trial.status !== 'fail') { best = { width, height }; break; }
    }
  }
  return best ? { width: String(best.width), height: String(best.height) } : null;
}
