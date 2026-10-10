import { MAX_SPANS, type BeamDesignInput, type BeamEnd } from '../../../design/elements/beam';
import { designCode, type DesignCodeId } from '../../../design/elements/codes';
import type { BeamDraft, SpanDraft } from './beamModel';
import type { BeamDetailDraft } from './beamDetailDraft';
import { parseBeamDetails } from './beamDetailInput';
import { mpaFromKgcm2, parseNumber, sustainedRatioFor, xiFor } from './formNumbers';

const validEnd = (value: string): BeamEnd => value === 'roller' || value === 'fixed' || value === 'free' ? value : 'pin';

/** Pure adapter from complete serialized form state to the beam solver. */
export function beamToInput(codeId: DesignCodeId, draft: BeamDraft, spans: readonly SpanDraft[], useOwn = true, details?: BeamDetailDraft): BeamDesignInput {
  const physical = details ? parseBeamDetails(details, spans) : undefined;
  return {
    code: codeId,
    widthMm: parseNumber(draft.width) * 10, heightMm: parseNumber(draft.height) * 10, coverMm: parseNumber(draft.cover) * 10,
    fcMpa: mpaFromKgcm2(draft.fc), fyMpa: mpaFromKgcm2(draft.fy), fyStirrupMpa: mpaFromKgcm2(draft.fyv),
    spans: spans.map((span) => {
      const points = draft.points === 'yes';
      return { lengthM: parseNumber(span.length), deadKnPerM: parseNumber(span.dead), liveKnPerM: parseNumber(span.live),
        pointDeadKn: points ? parseNumber(span.pointDead) : 0, pointLiveKn: points ? parseNumber(span.pointLive) : 0,
        pointAtM: points ? parseNumber(span.pointAt) : parseNumber(span.length) / 2 };
    }),
    extraLoads: physical?.loads ?? [], leftEnd: validEnd(draft.leftEnd), rightEnd: validEnd(draft.rightEnd),
    includeSelfWeight: draft.selfWeight === 'yes', combinations: designCode(codeId).loadCombinations(draft.group === 'A' ? 'A' : 'B'),
    sustainedLiveRatio: designCode(codeId).sustainedLive === 'use' ? sustainedRatioFor(draft.use) : parseNumber(draft.sustained) / 100,
    longTermXi: xiFor(draft.duration), barDiameterMm: draft.bar === 'auto' ? null : parseNumber(draft.bar),
    stirrupDiameterMm: draft.stirrup === 'auto' ? null : parseNumber(draft.stirrup), maxAggregateMm: parseNumber(draft.aggregate),
    damagesNonstructural: draft.damages === 'yes', supportWidthMm: parseNumber(draft.supportWidth) * 10,
    flange: draft.sectionType === 'T' || draft.sectionType === 'L' ? { kind: draft.sectionType,
      widthMm: parseNumber(draft.flangeWidth) * 10, thicknessMm: parseNumber(draft.flangeThickness) * 10, clearDistanceMm: parseNumber(draft.flangeClear) * 1000 } : null,
    provided: useOwn && draft.rebarMode === 'own' ? {
      top: { count: parseNumber(draft.topCount), diameterMm: parseNumber(draft.topBar) },
      bottom: { count: parseNumber(draft.bottomCount), diameterMm: parseNumber(draft.bottomBar) },
      bastions: draft.ownBastions === 'none' ? 'none' : draft.ownBastions === 'custom' ? 'custom' : 'auto',
      ...(draft.ownBastions === 'custom' ? { customBastions: physical?.bastions ?? [] } : {}),
      stirrupSpacingMm: draft.stirrupSpacing.trim() === '' ? null : parseNumber(draft.stirrupSpacing) * 10,
      ...(physical ? { stirrupZones: physical.stirrupZones } : {}),
    } : null,
  };
}

export function parseSpanDraft(raw: unknown): SpanDraft[] | undefined {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SPANS) return undefined;
  const spans = raw.map((item: unknown) => {
    if (!item || typeof item !== 'object') return undefined;
    const record = item as Record<string, unknown>;
    const pointAt = typeof record.pointAt === 'string' && record.pointAt.length <= 32 ? record.pointAt
      : typeof record.length === 'string' && record.length.length <= 32 ? String(parseNumber(record.length) / 2) : undefined;
    const withPoint: Record<string, unknown> = { ...record, pointAt };
    const fields = ['length', 'dead', 'live', 'pointDead', 'pointLive', 'pointAt'] as const;
    return fields.every((field) => typeof withPoint[field] === 'string' && (withPoint[field] as string).length <= 32)
      ? Object.fromEntries(fields.map((field) => [field, withPoint[field]])) as unknown as SpanDraft : undefined;
  });
  return spans.every(Boolean) ? spans as SpanDraft[] : undefined;
}
