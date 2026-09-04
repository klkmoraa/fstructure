import { memo, useMemo } from 'react';
import type { AnalysisResult, NodeModel, ProjectModel } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { segmentBezierControls } from '../../engine/diagram';
import { memberAxis } from '../../graphics/structureGeometry';
import { canvasSafeInsetsFor } from './canvasChromeGeometry';
import { formatFixed } from '../../utils/numberFormat';
import { STACK_QUANTITIES, STACK_SYMBOLS, type StackQuantity } from './diagramStack';

type MemberResult = AnalysisResult['memberResults'][number];
type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;
type DiagramSize = { width: number; height: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
type StackCell = { quantity: StackQuantity; x: number; y: number; width: number; height: number };
/** Un lienzo estrecho o bajo dibuja la lámina con métricas propias, no con las de escritorio. */
const isCompactViewport = (size: DiagramSize) => size.width < 700 || size.height < 600;

const boundsOf = (project: ProjectModel): Bounds => {
  const [first, ...rest] = project.nodes;
  if (!first) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  return rest.reduce<Bounds>((bounds, node) => ({
    minX: Math.min(bounds.minX, node.x), maxX: Math.max(bounds.maxX, node.x),
    minY: Math.min(bounds.minY, node.y), maxY: Math.max(bounds.maxY, node.y),
  }), { minX: first.x, maxX: first.x, minY: first.y, maxY: first.y });
};

const maximumFor = (results: readonly MemberResult[], quantity: StackQuantity): number => Math.max(
  1e-9,
  ...results.map((result) => quantity === 'axial'
    ? Math.max(Math.abs(result.minAxial), Math.abs(result.maxAxial))
    : quantity === 'shear'
      ? Math.max(Math.abs(result.minShear), Math.abs(result.maxShear))
      : Math.max(Math.abs(result.minMoment), Math.abs(result.maxMoment))),
);

/**
 * Dónde se dibuja la lámina de ACM, en TODAS las composiciones.
 *
 * ACM es una lámina de cálculo debajo del modelo: la estructura completa se
 * repite para N, V y M en la parte baja del lienzo, y el modelo editable se
 * encuadra en lo que queda arriba (`stackBottomReserve`). No hay ventana, ni
 * pestañas, ni una máscara que apague el modelo: antes, en móvil, ACM pintaba
 * un rectángulo opaco sobre todo el lienzo y el modelo desaparecía.
 */
const stackCells = (bounds: Bounds, size: DiagramSize, quantities: readonly StackQuantity[]): { cells: StackCell[]; bottomReserve: number } => {
  if (!quantities.length) return { cells: [], bottomReserve: 0 };
  const compact = isCompactViewport(size);
  const outerX = compact ? 12 : 30;
  const outerRight = compact ? 12 : 178;
  const lanes = quantities.length;
  const gap = compact ? 6 : 18;
  // ACM se lee como en los ejemplos resueltos: un diagrama estructural completo
  // debajo de otro. El pórtico ancho reparte sus tres copias a lo ancho.
  const aspect = (bounds.maxX - bounds.minX) / Math.max(1e-9, bounds.maxY - bounds.minY);
  if (!compact) {
    const bottom = 30;
    if (aspect < 1.8) {
      const height = Math.max(210, Math.min(380, size.height * .44));
      const width = Math.max(1, (size.width - outerX - outerRight - gap * (lanes - 1)) / lanes);
      const y = size.height - bottom - height;
      return {
        cells: quantities.map((quantity, index) => ({ quantity, x: outerX + index * (width + gap), y, width, height })),
        bottomReserve: height + bottom + 44,
      };
    }
    const height = Math.max(112, Math.min(210, (size.height * .58 - gap * (lanes - 1)) / lanes));
    const total = lanes * height + (lanes - 1) * gap;
    return {
      cells: quantities.map((quantity, index) => ({ quantity, x: outerX, y: size.height - bottom - total + index * (height + gap), width: size.width - outerX - outerRight, height })),
      bottomReserve: total + bottom + 44,
    };
  }

  /*
   * La lámina compacta se dimensiona CONTRA lo que le queda al modelo, no
   * contra la altura total del lienzo.
   *
   * Con un alto fijo de carril y una franja inferior fija, un lienzo bajo y
   * ancho —un teléfono en horizontal, 844×390— se lo comía todo: la reserva
   * salía 273px y, con los 116px de inset superior que declara
   * `canvasSafeInsetsFor`, al modelo le quedaba menos de un píxel.
   * `cameraToFitBounds` recorta ese rectángulo a 1px y conserva su escala
   * mínima, así que el modelo se dibujaba ENCIMA de la lámina en lugar de
   * arriba de ella: exactamente la ventana que este cambio venía a eliminar.
   *
   * Ahora la banda del modelo se aparta primero y los carriles se reparten lo
   * que sobra. Los 24px de suelo son la última parada: por debajo de eso un
   * diagrama ya no dice nada, y preferimos ceder banda que dibujar carriles
   * invisibles.
   */
  const bottom = Math.min(74, Math.max(34, size.height * .16));
  const tail = 12;
  const modelBand = Math.max(56, Math.min(92, size.height * .24));
  const room = Math.max(0, size.height - canvasSafeInsetsFor(size).top - modelBand - bottom - tail);
  const height = Math.min(
    96,
    (size.height * .48 - gap * (lanes - 1)) / lanes,
    Math.max(24, (room - gap * (lanes - 1)) / lanes),
  );
  const total = lanes * height + (lanes - 1) * gap;
  const y = size.height - bottom - total;
  return {
    cells: quantities.map((quantity, index) => ({ quantity, x: outerX, y: y + index * (height + gap), width: size.width - outerX - outerRight, height })),
    bottomReserve: total + bottom + tail,
  };
};

/**
 * Alto que el encuadre del modelo debe dejar libre en la parte baja del lienzo
 * mientras ACM está activo. Vale en todas las composiciones: la lámina siempre
 * va DEBAJO del modelo, nunca encima.
 */
export const stackBottomReserve = (project: ProjectModel, size: DiagramSize, quantityCount: number): number =>
  stackCells(boundsOf(project), size, STACK_QUANTITIES.slice(0, Math.max(1, quantityCount))).bottomReserve;

/**
 * ACM es una lectura estructural completa AL LADO del modelo, nunca encima ni
 * en lugar de él: la estructura se repite en la parte baja del lienzo para N, V
 * y M mientras el modelo editable sigue dibujado arriba.
 */
export const CanvasDiagramStack = memo(({
  project, results, quantities, nodeMap, size, t,
}: {
  project: ProjectModel;
  results: readonly MemberResult[];
  quantities: readonly StackQuantity[];
  nodeMap: ReadonlyMap<string, NodeModel>;
  size: DiagramSize;
  t: Translate;
}) => {
  const compact = isCompactViewport(size);
  const resultMap = useMemo(() => new Map(results.map((result) => [result.memberId, result])), [results]);
  const visibleQuantities = useMemo(() => STACK_QUANTITIES.filter((quantity) => quantities.includes(quantity)), [quantities]);
  const bounds = useMemo(() => boundsOf(project), [project]);
  const cells = useMemo(() => stackCells(bounds, size, visibleQuantities).cells, [bounds, size, visibleQuantities]);
  const maxima = useMemo(() => Object.fromEntries(STACK_QUANTITIES.map((quantity) => [quantity, maximumFor(results, quantity)])) as Record<StackQuantity, number>, [results]);
  const solvedMembers = useMemo(() => project.members.flatMap((member) => {
    const result = resultMap.get(member.id);
    const start = nodeMap.get(member.i);
    const end = nodeMap.get(member.j);
    if (!result?.diagramSegments.length || !start || !end) return [];
    const axis = memberAxis(member, start, end);
    return axis.length > 1e-12 ? [{ member, result, start, end, axis }] : [];
  }), [nodeMap, project.members, resultMap]);

  if (!cells.length || !solvedMembers.length) return null;
  const labelFor = (quantity: StackQuantity) => quantity === 'axial'
    ? t('results.axial')
    : quantity === 'shear'
      ? t('results.shear')
      : t('results.moment');
  const formatValue = (value: number) => {
    const stable = Math.abs(value) < 5e-8 ? 0 : value;
    const text = formatFixed(stable, Math.abs(stable) >= 100 ? 0 : 2, 'canvas');
    return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
  };

  return <g className={`diagram-stack-layer diagram-stack-layer--sheet${compact ? ' is-compact' : ''}`} data-canvas-layer="diagram-stack" data-stack-density={compact ? 'compact' : 'wide'} aria-label={t('canvas.evidenceStackStructure')}>
    <title>{t('canvas.evidenceStackStructureDetail')}</title>
    {cells.map((cell) => {
      const spanX = Math.max(1e-9, bounds.maxX - bounds.minX);
      const spanY = Math.max(1e-9, bounds.maxY - bounds.minY);
      const titleHeight = compact ? 14 : 0;
      const paddingX = compact ? 4 : 16;
      const paddingY = compact ? 4 : 0;
      const topInset = compact ? 0 : 22;
      const padding = compact ? 0 : 16;
      const amplitude = compact
        ? Math.max(10, Math.min(19, cell.height * .17))
        : Math.max(17, Math.min(34, cell.height * .2));
      // Keep the entire portal and the signed diagram offsets inside its lane.
      // Compact mode uses a dedicated scene; desktop keeps the established
      // exterior calculation sheet geometry.
      const usableHeight = compact
        ? Math.max(1, cell.height - titleHeight - paddingY * 2 - amplitude * 2)
        : Math.max(1, cell.height - topInset - padding - amplitude * 2);
      const usableWidth = compact ? Math.max(1, cell.width - paddingX * 2) : cell.width - padding * 2;
      const scale = Math.min(usableWidth / spanX, usableHeight / spanY);
      const contentWidth = spanX * scale;
      const contentHeight = spanY * scale;
      const originX = cell.x + (cell.width - contentWidth) / 2 - bounds.minX * scale;
      const originY = compact
        ? cell.y + titleHeight + paddingY + amplitude + (usableHeight - contentHeight) / 2 + bounds.maxY * scale
        : cell.y + topInset + amplitude + (usableHeight - contentHeight) / 2 + bounds.maxY * scale;
      const screenPoint = (node: NodeModel) => ({ x: originX + node.x * scale, y: originY - node.y * scale });
      return <g key={cell.quantity} className={`diagram-stack-panel ${cell.quantity}`} data-stack-panel={cell.quantity}>
        <text className="diagram-stack-panel-title" x={cell.x} y={cell.y + (compact ? 11 : 10)}>{compact ? STACK_SYMBOLS[cell.quantity] : `${STACK_SYMBOLS[cell.quantity]} · ${labelFor(cell.quantity)}`}</text>
        {solvedMembers.map(({ member, result, start, end, axis }) => {
          const memberStart = screenPoint(start);
          const memberEnd = screenPoint(end);
          const dx = memberEnd.x - memberStart.x;
          const dy = memberEnd.y - memberStart.y;
          const length = Math.hypot(dx, dy) || 1;
          const normal = { x: -dy / length, y: dx / length };
          const position = (x: number, value = 0) => {
            const ratio = ((result.startOffset ?? 0) + x) / axis.length;
            const base = { x: memberStart.x + dx * ratio, y: memberStart.y + dy * ratio };
            const pixels = value * amplitude / maxima[cell.quantity];
            return { x: base.x + normal.x * pixels, y: base.y + normal.y * pixels };
          };
          const first = segmentBezierControls(result.diagramSegments[0], cell.quantity);
          const baselineStart = position(0);
          const firstPoint = position(first.x0, first.y0);
          const line = [`M ${firstPoint.x} ${firstPoint.y}`];
          const fill = [`M ${baselineStart.x} ${baselineStart.y}`, `L ${firstPoint.x} ${firstPoint.y}`];
          result.diagramSegments.forEach((segment, index) => {
            const control = segmentBezierControls(segment, cell.quantity);
            const c1 = position(control.c1x, control.c1y);
            const c2 = position(control.c2x, control.c2y);
            const point = position(control.x1, control.y1);
            const curve = `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${point.x} ${point.y}`;
            line.push(curve); fill.push(curve);
            const next = result.diagramSegments[index + 1];
            if (!next) return;
            const nextControl = segmentBezierControls(next, cell.quantity);
            if (Math.abs(nextControl.y0 - control.y1) > 1e-10) {
              const jump = position(nextControl.x0, nextControl.y0);
              line.push(`L ${jump.x} ${jump.y}`); fill.push(`L ${jump.x} ${jump.y}`);
            }
          });
          const baselineEnd = position(result.length);
          fill.push(`L ${baselineEnd.x} ${baselineEnd.y}`, 'Z');
          const midpoint = { x: (memberStart.x + memberEnd.x) / 2, y: (memberStart.y + memberEnd.y) / 2 };
          const readingPoints = result.criticalPoints
            .filter((point) => point.quantity === cell.quantity && (point.kind === 'maximum' || point.kind === 'minimum' || point.kind === 'end'))
            .filter((point, index, points) => index === points.findIndex((candidate) => Math.abs(candidate.x - point.x) < 1e-9 && Math.abs(candidate.value - point.value) < 1e-9))
            .slice(0, compact ? 2 : 3);
          return <g key={`${member.id}:${cell.quantity}`} className={`diagram-stack-member-lane ${cell.quantity}`} data-stack-member={member.id} data-stack-lane={cell.quantity}>
            <line className="diagram-stack-replica-member" x1={memberStart.x} y1={memberStart.y} x2={memberEnd.x} y2={memberEnd.y} />
            <path className="diagram-stack-member-baseline" d={`M ${baselineStart.x} ${baselineStart.y} L ${baselineEnd.x} ${baselineEnd.y}`} />
            <path className="diagram-stack-member-fill" d={fill.join(' ')} />
            <path className="diagram-stack-member-line" d={line.join(' ')} />
            {!compact ? <text className="diagram-stack-member-label" x={midpoint.x} y={midpoint.y - 6} textAnchor="middle">{member.id}</text> : null}
            {readingPoints.map((point, index) => {
              const reading = position(point.x, point.value);
              const side = Math.sign(point.value) || (index % 2 ? -1 : 1);
              return <g key={`${point.kind}:${point.x}:${point.value}`} className="diagram-stack-reading" data-stack-reading={`${member.id}:${cell.quantity}:${point.kind}`}>
                <circle cx={reading.x} cy={reading.y} r={compact ? 1.6 : 2.4} />
                <text x={reading.x + normal.x * side * (compact ? 6 : 7)} y={reading.y + normal.y * side * (compact ? 6 : 7) - 2} textAnchor="middle">{formatValue(point.value)}</text>
              </g>;
            })}
            <title>{`${member.id} · ${STACK_SYMBOLS[cell.quantity]}`}</title>
          </g>;
        })}
      </g>;
    })}
  </g>;
});
