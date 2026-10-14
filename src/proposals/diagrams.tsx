import { useId } from 'react';
import type { ReactNode } from 'react';

type BeamDiagramProps = {
  kind: 'freebody' | 'moment';
  /** Posición normalizada de lectura (0–1); no interpola un valor de momento. */
  cursor?: number;
};

const PAPER = 'var(--sc-color-surface-1, var(--fs-paper-0))';
const INK = 'var(--sc-color-text-primary, var(--fs-paper-900))';
const TECHNICAL = 'var(--sc-color-text-technical, var(--fs-paper-700))';
const MUTED = 'var(--sc-color-text-secondary, var(--fs-paper-700))';
const RULE = 'var(--sc-color-border-strong, var(--fs-paper-400))';
const AXIAL = 'var(--fs-signal-axial)';
const MOMENT = 'var(--fs-signal-moment)';
const SHEAR = 'var(--fs-signal-shear)';
const FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';
const DATA_FONT = 'IBM Plex Mono, ui-monospace, monospace';

function useSvgIds(prefix: string) {
  const id = useId().replace(/:/g, '');
  return { titleId: `proposal-${prefix}-${id}-title`, descId: `proposal-${prefix}-${id}-desc` };
}

function SvgFrame({
  className,
  viewBox,
  titleId,
  descId,
  title,
  description,
  children,
}: {
  className: string;
  viewBox: string;
  titleId: string;
  descId: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={`proposal-diagram proposal-svg ${className}`}
      viewBox={viewBox}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      style={{ display: 'block', color: INK, fontFamily: FONT, overflow: 'visible' }}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      {children}
    </svg>
  );
}

function Text({
  x,
  y,
  children,
  anchor = 'start',
  size = 14,
  fill = INK,
  weight = 500,
  mono = false,
  className,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  size?: number;
  fill?: string;
  weight?: number;
  mono?: boolean;
  className?: string;
}) {
  return (
    <text
      className={className ? `proposal-${className}` : 'proposal-label'}
      x={x}
      y={y}
      textAnchor={anchor}
      fill={fill}
      fontFamily={mono ? DATA_FONT : FONT}
      fontSize={size}
      fontWeight={weight}
      style={mono ? { fontVariantNumeric: 'tabular-nums' } : undefined}
    >
      {children}
    </text>
  );
}

function Arrow({
  x,
  y1,
  y2,
  color,
  className = 'arrow',
}: {
  x: number;
  y1: number;
  y2: number;
  color: string;
  className?: string;
}) {
  const down = y2 > y1;
  const tipY = y2;
  const head = down
    ? `M${x - 5},${tipY - 8} L${x},${tipY} L${x + 5},${tipY - 8}`
    : `M${x - 5},${tipY + 8} L${x},${tipY} L${x + 5},${tipY + 8}`;
  return (
    <g className={`proposal-${className}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      <line x1={x} x2={x} y1={y1} y2={down ? tipY - 1 : tipY + 1} />
      <path d={head} />
    </g>
  );
}

function Support({ x, y }: { x: number; y: number }) {
  return (
    <g className="proposal-support" fill={PAPER} stroke={TECHNICAL} strokeWidth="1.7" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      <path d={`M${x},${y} l-10,13 h20 z`} />
      <line x1={x - 14} x2={x + 14} y1={y + 15} y2={y + 15} />
      <line x1={x - 10} x2={x - 6} y1={y + 19} y2={y + 15} />
      <line x1={x - 2} x2={x + 2} y1={y + 19} y2={y + 15} />
      <line x1={x + 6} x2={x + 10} y1={y + 19} y2={y + 15} />
    </g>
  );
}

export function BeamDiagram({ kind, cursor }: BeamDiagramProps) {
  const { titleId, descId } = useSvgIds(`beam-${kind}`);
  const x1 = 62;
  const x2 = 338;
  const readX = x1 + (x2 - x1) * Math.max(0, Math.min(1, Number.isFinite(cursor) ? cursor ?? 0 : 0));

  if (kind === 'freebody') {
    const supports = [
      { x: 70, name: 'RA', value: '75.8 kN' },
      { x: 200, name: 'RB', value: '218.2 kN' },
      { x: 330, name: 'RC', value: '51.6 kN' },
    ];
    return (
      <SvgFrame
        className="proposal-beam proposal-beam--freebody"
        viewBox="0 0 400 166"
        titleId={titleId}
        descId={descId}
        title="Diagrama de cuerpo libre de la viga continua"
        description="Tres reacciones verticales: RA 75.8 kilonewtons, RB 218.2 kilonewtons y RC 51.6 kilonewtons. Dibujo esquemático sin cargas ni longitudes asignadas."
      >
        <g fill="none" stroke="var(--fs-load-distributed)" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          <line x1="95" x2="305" y1="50" y2="50" />
          {[95, 120, 145, 170, 225, 250, 275, 300].map((x) => <g key={x}><line x1={x} x2={x} y1="50" y2="77" /><path d={`M${x - 3} 73 l3 4 3 -4`} /></g>)}
        </g>
        <line className="proposal-member" x1="55" x2="345" y1="83" y2="83" stroke={TECHNICAL} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {supports.map(({ x, name, value }) => (
          <g className="proposal-reaction" key={name}>
            <Arrow x={x} y1={77} y2={60} color={AXIAL} className="reaction-arrow" />
            <Text x={x} y={22} anchor="middle" size={14} fill={TECHNICAL} mono>{name}</Text>
            <Text x={x} y={39} anchor="middle" size={14} fill={AXIAL} mono weight={600}>{value}</Text>
            <Support x={x} y={84} />
          </g>
        ))}
      </SvgFrame>
    );
  }

  return (
    <SvgFrame
      className="proposal-beam proposal-beam--moment"
      viewBox="0 0 400 190"
      titleId={titleId}
      descId={descId}
      title="Extremos del diagrama de momento"
      description="Momento mínimo menos 100.8 kilonewton metro y máximo 82.9 kilonewton metro. El trazo y el cursor son esquemáticos; no se dispone de estaciones ni de valores interpolados."
    >
      <line className="proposal-moment-axis" x1="62" x2="338" y1="101" y2="101" stroke={RULE} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path className="proposal-moment-envelope" d="M62 101 C100 101 112 67 145 67 C177 67 184 126 214 126 C243 126 252 76 286 76 C308 76 320 101 338 101" fill="none" stroke={MOMENT} strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle className="proposal-moment-extreme" cx="145" cy="67" r="4" fill={MOMENT} />
      <circle className="proposal-moment-extreme" cx="214" cy="126" r="4" fill={MOMENT} />
      <g className="proposal-moment-labels">
        <line x1="145" x2="145" y1="62" y2="43" stroke={MOMENT} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <Text x={145} y={39} anchor="middle" size={14} fill={MOMENT} mono weight={600}>M máx 82.9 kN·m</Text>
        <line x1="214" x2="214" y1="131" y2="148" stroke={MOMENT} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        <Text x={214} y={166} anchor="middle" size={14} fill={MOMENT} mono weight={600}>M mín −100.8 kN·m</Text>
      </g>
      <g className="proposal-cursor" aria-hidden="true">
        <line x1={readX} x2={readX} y1="53" y2="143" stroke={TECHNICAL} strokeWidth="1.4" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <path d={`M${readX - 5} 51 l5 -7 5 7 z`} fill={TECHNICAL} />
      </g>
    </SvgFrame>
  );
}

const PRATT_NODES = {
  B0: [38, 172], B1: [98, 172], B2: [158, 172], B3: [218, 172], B4: [278, 172],
  T1: [98, 80], T2: [158, 80], T3: [218, 80],
} as const;

const PRATT_MEMBERS: readonly { from: keyof typeof PRATT_NODES; to: keyof typeof PRATT_NODES; kind: 'chord' | 'vertical' | 'outer' | 'inner' }[] = [
  { from: 'B0', to: 'B1', kind: 'chord' }, { from: 'B1', to: 'B2', kind: 'chord' }, { from: 'B2', to: 'B3', kind: 'chord' }, { from: 'B3', to: 'B4', kind: 'chord' },
  { from: 'T1', to: 'T2', kind: 'chord' }, { from: 'T2', to: 'T3', kind: 'chord' },
  { from: 'B0', to: 'T1', kind: 'outer' }, { from: 'T1', to: 'B2', kind: 'inner' },
  { from: 'T3', to: 'B2', kind: 'inner' }, { from: 'T3', to: 'B4', kind: 'outer' },
  { from: 'B1', to: 'T1', kind: 'vertical' }, { from: 'B2', to: 'T2', kind: 'vertical' }, { from: 'B3', to: 'T3', kind: 'vertical' },
];

function PrattMembers({ mini = false }: { mini?: boolean }) {
  return (
    <g className={mini ? 'proposal-pratt-mini-members' : 'proposal-pratt-members'}>
      {PRATT_MEMBERS.map(({ from, to, kind }) => {
        const [x1, y1] = PRATT_NODES[from];
        const [x2, y2] = PRATT_NODES[to];
        const stroke = kind === 'vertical' ? RULE : kind === 'outer' ? MOMENT : kind === 'inner' ? AXIAL : TECHNICAL;
        const strokeWidth = mini ? 1.35 : kind === 'chord' ? 2.7 : kind === 'vertical' ? 1.6 : 2.4;
        return <line key={`${from}-${to}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" vectorEffect="non-scaling-stroke" />;
      })}
      {Object.entries(PRATT_NODES).map(([id, [x, y]]) => <circle key={id} cx={x} cy={y} r={mini ? 1.7 : 3} fill={INK} />)}
    </g>
  );
}

function PrattSupports() {
  return (
    <g className="proposal-pratt-supports" fill={PAPER} stroke={TECHNICAL} strokeWidth="1.5" vectorEffect="non-scaling-stroke">
      <path d="M38 173 l-8 10 h16 z" />
      <path d="M278 173 l-8 9 h16 z" />
      <circle cx="274" cy="186" r="2" fill={PAPER} />
      <circle cx="282" cy="186" r="2" fill={PAPER} />
      <line x1="24" x2="52" y1="188" y2="188" />
      <line x1="264" x2="292" y1="192" y2="192" />
    </g>
  );
}

export function PrattDiagram({ compact = false }: { compact?: boolean } = {}) {
  const { titleId, descId } = useSvgIds('pratt');
  const inset = compact === false;
  return (
    <SvgFrame
      className={`proposal-pratt${compact ? ' proposal-pratt--compact' : ''}`}
      viewBox={`0 0 440 ${inset ? 258 : 226}`}
      titleId={titleId}
      descId={descId}
      title="Geometría simétrica de armadura Pratt"
      description="Geometría basada en el inicio truss-pratt: cuatro paneles simétricos, montantes grises, diagonales en azul y rojo. N máximo 24.00. Esquema de geometría; no valida el cálculo."
    >
      <PrattMembers />
      <PrattSupports />
      <Text x={318} y={77} size={13} fill={AXIAL} mono weight={600}>N máx</Text>
      <Text x={318} y={100} size={14} fill={AXIAL} className="axial-maximum" mono weight={600}>24.00 kN</Text>
      {!compact ? (
        <g className="proposal-pratt-inset" aria-hidden="true">
          <rect x="318" y="158" width="92" height="55" rx="3" fill="none" stroke={RULE} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <g transform="translate(325 163) scale(.29 .24)"><PrattMembers mini /></g>
          <Text x={364} y={229} anchor="middle" size={13} fill={MUTED} className="inset-caption">Topología base</Text>
        </g>
      ) : null}
    </SvgFrame>
  );
}

export function FootingDiagram() {
  const { titleId, descId } = useSvgIds('footing');
  const left = 50;
  const right = 380;
  const top = 160;
  const bottom = 270;
  const center = (left + right) / 2;
  const pedestalHalf = 36;
  const depth = 91.8;
  const cuts = [
    { x: center - pedestalHalf, label: 'M', color: MOMENT, labelY: 143 },
    { x: center - pedestalHalf - depth / 2, label: 'd/2', color: AXIAL, labelY: 124 },
    { x: center - pedestalHalf - depth, label: 'd', color: SHEAR, labelY: 143 },
    { x: center + pedestalHalf, label: 'M', color: MOMENT, labelY: 143 },
    { x: center + pedestalHalf + depth / 2, label: 'd/2', color: AXIAL, labelY: 124 },
    { x: center + pedestalHalf + depth, label: 'd', color: SHEAR, labelY: 143 },
  ];
  return (
    <SvgFrame
      className="proposal-footing"
      viewBox="0 0 470 326"
      titleId={titleId}
      descId={descId}
      title="Corte esquemático de zapata aislada"
      description="Carga Pu 1230 kilonewtons sobre pedestal, peralte h 55 centímetros, peralte efectivo d 45.9 centímetros y presión uniforme 205 kilopascales. Cortes de referencia M, d entre 2 y d medidos desde ambas caras del pedestal. Esquema sin dimensiones en planta."
    >
      <Arrow x={center} y1={35} y2={72} color={AXIAL} className="column-load" />
      <Text x={center + 12} y={52} size={14} fill={AXIAL} mono weight={600}>Pu = 1,230 kN</Text>
      <rect className="proposal-pedestal" x={center - pedestalHalf} y="72" width={pedestalHalf * 2} height={top - 72} fill="var(--sc-color-surface-2, var(--fs-paper-100))" stroke={TECHNICAL} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <rect className="proposal-footing-body" x={left} y={top} width={right - left} height={bottom - top} fill="var(--sc-color-surface-1, var(--fs-paper-0))" stroke={TECHNICAL} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <line className="proposal-footing-rebar" x1={left + 12} x2={right - 12} y1={bottom - 18.2} y2={bottom - 18.2} stroke={TECHNICAL} strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 9 }, (_, index) => <circle key={index} cx={left + 16 + index * ((right - left - 32) / 8)} cy={bottom - 18.2} r="2.5" fill={TECHNICAL} />)}
      {cuts.map(({ x, label, color, labelY }, index) => (
        <g className="proposal-critical-cut" key={`${label}-${index}`}>
          <line x1={x} x2={x} y1={top - 3} y2={bottom + 2} stroke={color} strokeWidth={label === 'M' ? 2 : 1.6} strokeDasharray={label === 'M' ? undefined : '5 3'} vectorEffect="non-scaling-stroke" />
          <line x1={x} x2={x} y1={labelY + 4} y2={top - 5} stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          <Text x={x} y={labelY} anchor="middle" size={13} fill={color} mono weight={600}>{label}</Text>
        </g>
      ))}
      <g className="proposal-footing-dimensions" fill="none" stroke={RULE} strokeWidth="1.3" vectorEffect="non-scaling-stroke">
        <line x1="397" x2="397" y1={top} y2={bottom} />
        <line x1="391" x2="403" y1={top} y2={top} />
        <line x1="391" x2="403" y1={bottom} y2={bottom} />
        <line x1="422" x2="422" y1={top} y2={bottom - 18.2} />
        <line x1="416" x2="428" y1={top} y2={top} />
        <line x1="416" x2="428" y1={bottom - 18.2} y2={bottom - 18.2} />
      </g>
      <g transform="rotate(-90 410 215)"><Text x={410} y={215} anchor="middle" size={13} fill={TECHNICAL} mono>h = 55 cm</Text></g>
      <g transform="rotate(-90 437 206)"><Text x={437} y={206} anchor="middle" size={13} fill={TECHNICAL} mono>d = 45.9 cm</Text></g>
      <g className="proposal-soil-pressure" fill="none" stroke={SHEAR} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {Array.from({ length: 9 }, (_, index) => {
          const x = left + 20 + index * ((right - left - 40) / 8);
          return <g key={index}><line x1={x} x2={x} y1="299" y2="282" /><path d={`M${x - 4} 287 l4 -5 4 5`} /></g>;
        })}
      </g>
      <Text x={center} y={321} anchor="middle" size={14} fill={SHEAR} mono weight={600}>q = 205 kPa</Text>
    </SvgFrame>
  );
}

function dimensionLabel(value: number) {
  return Number.isFinite(value) ? `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(value)} cm` : '—';
}

export function ColumnSection({ base, depth }: { base: number; depth: number }) {
  const { titleId, descId } = useSvgIds('column-section');
  const safeBase = Number.isFinite(base) && base > 0 ? base : 1;
  const safeDepth = Number.isFinite(depth) && depth > 0 ? depth : 1;
  const scale = Math.min(3.4, 166 / Math.max(safeBase, safeDepth));
  const width = safeBase * scale;
  const height = safeDepth * scale;
  const x = 190 - width / 2;
  const y = 128 - height / 2;
  const inset = Math.min(width, height) * 0.14;
  const barInset = inset + Math.min(width, height) * 0.07;
  const bottom = y + height;
  const dimY = Math.max(248, bottom + 26);
  const leftDimX = Math.max(22, x - 28);
  const titleBase = dimensionLabel(base);
  const titleDepth = dimensionLabel(depth);
  const corners = [
    [x + barInset, y + barInset], [x + width - barInset, y + barInset],
    [x + barInset, y + height - barInset], [x + width - barInset, y + height - barInset],
  ];
  return (
    <SvgFrame
      className="proposal-column-section"
      viewBox="0 0 380 304"
      titleId={titleId}
      descId={descId}
      title={`Sección esquemática de columna, base ${titleBase}, peralte ${titleDepth}`}
      description="Sección rectangular con contorno de estribo y cuatro barras de esquina como convención gráfica. No define recubrimiento, diámetros, cuantía ni cumplimiento normativo."
    >
      <rect className="proposal-column-concrete" x={x} y={y} width={width} height={height} fill="var(--sc-color-surface-2, var(--fs-paper-100))" stroke={TECHNICAL} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <rect className="proposal-column-tie" x={x + inset} y={y + inset} width={Math.max(1, width - 2 * inset)} height={Math.max(1, height - 2 * inset)} rx="2" fill="none" stroke={SHEAR} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      <g className="proposal-column-bars" fill={MOMENT} stroke={PAPER} strokeWidth="1" vectorEffect="non-scaling-stroke">
        {corners.map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={Math.max(3.4, Math.min(width, height) * 0.035)} />)}
      </g>
      <g className="proposal-column-dimensions" fill="none" stroke={RULE} strokeWidth="1.3" vectorEffect="non-scaling-stroke">
        <line x1={x} x2={x + width} y1={dimY} y2={dimY} />
        <line x1={x} x2={x} y1={dimY - 5} y2={dimY + 5} />
        <line x1={x + width} x2={x + width} y1={dimY - 5} y2={dimY + 5} />
        <line x1={leftDimX} x2={leftDimX} y1={y} y2={bottom} />
        <line x1={leftDimX - 5} x2={leftDimX + 5} y1={y} y2={y} />
        <line x1={leftDimX - 5} x2={leftDimX + 5} y1={bottom} y2={bottom} />
      </g>
      <Text x={190} y={dimY + 21} anchor="middle" size={14} fill={TECHNICAL} mono weight={600}>{`b = ${titleBase}`}</Text>
      <Text x={leftDimX - 11} y={y + height / 2} anchor="middle" size={14} fill={TECHNICAL} mono weight={600}>
        <tspan transform={`rotate(-90 ${leftDimX - 11} ${y + height / 2})`}>{`h = ${titleDepth}`}</tspan>
      </Text>
    </SvgFrame>
  );
}
