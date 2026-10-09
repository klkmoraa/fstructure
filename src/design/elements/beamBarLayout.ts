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
  let firstLayer = groups.slice(0, firstCount);
  if ((extra?.count ?? 0) > 0 && continuous.count >= 2 && firstCount >= 2) {
    const continuousBars = groups.filter(({ kind }) => kind === 'continuous');
    const endpoints = [continuousBars[0]!, continuousBars.at(-1)!];
    const middle = groups.filter((bar) => !endpoints.includes(bar)).slice(0, firstCount - 2);
    firstLayer = [endpoints[0]!, ...middle, endpoints[1]!];
  }
  const secondLayer = groups.filter((bar) => !firstLayer.includes(bar));
  [firstLayer, secondLayer].forEach((layerBars, layerIndex) => {
    if (!layerBars.length) return;
    const spacing = layerBars.length > 1 ? (inside - maxDiameter) / (layerBars.length - 1) : 0;
    for (let index = 0; index < layerBars.length; index += 1) {
      const bar = layerBars[index]!;
      placements.push({
        xMm: layerBars.length === 1 ? widthMm / 2 : coverMm + stirrupDiameterMm + maxDiameter / 2 + index * spacing,
        fromFaceMm: coverMm + stirrupDiameterMm + bar.diameterMm / 2 + layerIndex * (maxDiameter + Math.max(25, maxDiameter)),
        diameterMm: bar.diameterMm,
        kind: bar.kind,
        layer: (layerIndex + 1) as 1 | 2,
      });
    }
  });
  return placements;
}
