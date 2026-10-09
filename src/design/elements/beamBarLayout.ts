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
  const { widthMm, heightMm, coverMm, stirrupDiameterMm, minimumClearSpacingMm, continuous, extra } = input;
  const extraCount = extra?.count ?? 0;
  const geometry = [widthMm, heightMm, coverMm, stirrupDiameterMm, minimumClearSpacingMm];
  if (geometry.some((value) => !Number.isFinite(value))
    || widthMm <= 0 || heightMm <= 0 || coverMm < 0 || stirrupDiameterMm <= 0 || minimumClearSpacingMm <= 0
    || !Number.isSafeInteger(continuous.count) || continuous.count < 1
    || !Number.isSafeInteger(extraCount) || extraCount < 0
    || !Number.isFinite(continuous.diameterMm) || continuous.diameterMm <= 0
    || (extraCount > 0 && (!Number.isFinite(extra?.diameterMm) || extra!.diameterMm <= 0))) return null;

  const maxDiameter = Math.max(continuous.diameterMm, extraCount > 0 ? extra!.diameterMm : 0);
  const inside = widthMm - 2 * (coverMm + stirrupDiameterMm);
  if (!Number.isFinite(inside) || inside <= 0) return null;
  const perLayer = Math.floor((inside + minimumClearSpacingMm) / (maxDiameter + minimumClearSpacingMm));
  const total = continuous.count + extraCount;
  if (perLayer < 2 || total > 2 * perLayer) return null;

  const groups = [
    ...Array.from({ length: continuous.count }, () => ({ diameterMm: continuous.diameterMm, kind: 'continuous' as const })),
    ...Array.from({ length: extraCount }, () => ({ diameterMm: extra!.diameterMm, kind: 'extra' as const })),
  ];

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
  const farFaceLimitMm = heightMm - coverMm - stirrupDiameterMm;
  if (placements.some((bar) => bar.fromFaceMm + bar.diameterMm / 2 > farFaceLimitMm + 1e-9)) return null;
  return placements;
}
