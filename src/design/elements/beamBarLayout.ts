export interface BeamBarLayoutInput {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly coverMm: number;
  readonly stirrupDiameterMm: number;
  readonly minimumClearSpacingMm: number;
  readonly continuous: { readonly count: number; readonly diameterMm: number };
  readonly extra: { readonly count: number; readonly diameterMm: number } | null;
}

export interface BeamBarPlacement {
  readonly xMm: number;
  readonly fromFaceMm: number;
  readonly diameterMm: number;
  readonly kind: 'continuous' | 'extra';
  readonly layer: 1 | 2;
}

export function layoutBeamBed(input: BeamBarLayoutInput): readonly BeamBarPlacement[] | null {
  const { widthMm, coverMm, stirrupDiameterMm, minimumClearSpacingMm, continuous, extra } = input;
  const groups = [
    ...Array.from({ length: continuous.count }, () => ({ diameterMm: continuous.diameterMm, kind: 'continuous' as const })),
    ...Array.from({ length: extra?.count ?? 0 }, () => ({ diameterMm: extra!.diameterMm, kind: 'extra' as const })),
  ];
  if (!groups.length || groups.some(({ diameterMm }) => !Number.isFinite(diameterMm) || diameterMm <= 0)) return null;

  const maxDiameter = Math.max(...groups.map(({ diameterMm }) => diameterMm));
  const inside = widthMm - 2 * (coverMm + stirrupDiameterMm);
  const perLayer = Math.floor((inside + minimumClearSpacingMm) / (maxDiameter + minimumClearSpacingMm));
  if (perLayer < 2 || groups.length > 2 * perLayer) return null;

  const placements: BeamBarPlacement[] = [];
  const firstCount = Math.min(groups.length, perLayer);
  const layerCounts = [firstCount, groups.length - firstCount];
  let offset = 0;
  layerCounts.forEach((count, layerIndex) => {
    if (!count) return;
    const spacing = count > 1 ? (inside - maxDiameter) / (count - 1) : 0;
    for (let index = 0; index < count; index += 1) {
      const bar = groups[offset + index]!;
      placements.push({
        xMm: coverMm + stirrupDiameterMm + maxDiameter / 2 + index * spacing,
        fromFaceMm: coverMm + stirrupDiameterMm + bar.diameterMm / 2 + layerIndex * (maxDiameter + Math.max(25, maxDiameter)),
        diameterMm: bar.diameterMm,
        kind: bar.kind,
        layer: (layerIndex + 1) as 1 | 2,
      });
    }
    offset += count;
  });
  return placements;
}
