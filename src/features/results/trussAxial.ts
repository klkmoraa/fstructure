import type { AnalysisResult, MemberResult, ProjectModel } from '../../types';
import { isTrustedForCombination, resolveReliability } from '../../engine/reliability';

export interface TrussAxialReading {
  memberId: string;
  state: NonNullable<MemberResult['trussState']>;
  axial: number;
}

/** Reads only the current, numerically trustworthy two-force-member results.
 * Missing/legacy/unreliable results never become a fictitious zero-force bar. */
export const trussAxialReadings = (project: ProjectModel, analysis: AnalysisResult | null): ReadonlyMap<string, TrussAxialReading> => {
  const readings = new Map<string, TrussAxialReading>();
  if (!analysis?.success || !isTrustedForCombination(resolveReliability(analysis).level)) return readings;
  const trussIds = new Set(project.members.filter((member) => member.type === 'truss').map((member) => member.id));
  for (const result of analysis.memberResults) {
    if (!trussIds.has(result.memberId) || !result.trussState || !Number.isFinite(result.maxAxial) || !Number.isFinite(result.minAxial)) continue;
    const axial = (result.maxAxial + result.minAxial) / 2;
    readings.set(result.memberId, { memberId: result.memberId, state: result.trussState, axial: result.trussState === 'zero' ? 0 : axial });
  }
  return readings;
};

export const trussAxialLabel = (state: TrussAxialReading['state'], language: string) => language === 'es'
  ? ({ tension: 'Tensión', compression: 'Compresión', zero: 'Sin esfuerzo' } as const)[state]
  : ({ tension: 'Tension', compression: 'Compression', zero: 'Zero force' } as const)[state];

export const trussAxialSymbol = (state: TrussAxialReading['state']) => ({ tension: 'T', compression: 'C', zero: '0' } as const)[state];
