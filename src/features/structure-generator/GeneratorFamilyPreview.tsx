import type { GeneratorKind } from '../../data/generators/generatorTypes';

const nodes = (points: readonly [number, number][]) => points.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" />);

export const GeneratorFamilyPreview = ({ family }: { family: GeneratorKind }) => {
  const common = { fill: 'none', vectorEffect: 'non-scaling-stroke' as const };
  return <svg className="generator-family-preview" viewBox="0 0 96 54" aria-hidden="true" focusable="false">
    <path className="generator-family-preview__ground" d="M8 47H88" {...common} />
    {family === 'continuous-beam' ? <>
      <path d="M10 24H86" {...common} />
      <path d="m18 24-7 12h14Zm31 0-7 12h14Zm29 0-7 12h14Z" {...common} />
      <g>{nodes([[18, 24], [49, 24], [78, 24]])}</g>
    </> : null}
    {family === 'portal-frame' ? <>
      <path d="M20 44V13H76V44" {...common} />
      <path d="m20 44-7 3h14Zm56 0-7 3h14Z" {...common} />
      <g>{nodes([[20, 13], [76, 13]])}</g>
    </> : null}
    {family === 'multi-story-frame' ? <>
      <path d="M18 46V8M48 46V8M78 46V8M18 20H78M18 33H78" {...common} />
      <g>{nodes([[18, 20], [48, 20], [78, 20], [18, 33], [48, 33], [78, 33]])}</g>
    </> : null}
    {family === 'truss' ? <>
      <path d="M10 40H86L48 10 10 40Zm19-15 19 15 19-15M29 25h38" {...common} />
      <g>{nodes([[10, 40], [29, 25], [48, 10], [67, 25], [86, 40], [48, 40]])}</g>
    </> : null}
    {family === 'grid' ? <>
      <path d="m18 38 40 9 22-25-40-9-22 25Zm13 3 22-25m-4 29 22-25M25 30l40 9M33 21l40 9" {...common} />
      <g>{nodes([[18, 38], [40, 13], [80, 22], [58, 47]])}</g>
    </> : null}
    {family === 'circular-arch' ? <>
      <path d="M12 42L15 30L23 18L35 11L48 8L61 11L73 18L81 30L84 42" {...common} />
      <g>{nodes([[12, 42], [23, 18], [48, 8], [73, 18], [84, 42]])}</g>
    </> : null}
    {family === 'circular-ring' ? <>
      <path d="M70 27L64 12L48 6L32 12L26 27L32 42L48 48L64 42Z" {...common} />
      <g>{nodes([[70, 27], [48, 6], [26, 27], [48, 48]])}</g>
    </> : null}
    {family === 'pitched-portal' ? <>
      <path d="M16 44V26L43 8L80 20V44" {...common} />
      <g>{nodes([[16, 44], [16, 26], [43, 8], [80, 20], [80, 44]])}</g>
    </> : null}
  </svg>;
};
