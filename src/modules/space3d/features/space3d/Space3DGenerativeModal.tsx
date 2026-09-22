/**
 * Modal generador de estructuras espaciales 3D paramétricas.
 *
 * Usa un parser determinista y local para interpretar descripciones breves; no
 * envía prompts ni depende de un modelo generativo externo. La previsualización
 * isométrica permite revisar la geometría antes de reemplazar el proyecto.
 */
import { useId, useMemo, useState } from 'react';
import {
  Box,
  Building2,
  GitBranch,
  Sparkles,
  TowerControl,
  Wand2,
  Warehouse,
} from 'lucide-react';
import { Dialog } from '../../../../design-system/components/overlays';
import {
  generateSpace3DBridge,
  generateSpace3DDome,
  generateSpace3DFrame,
  generateSpace3DIndustrialShed,
  generateSpace3DTower,
  generateSpace3DTruss,
  parseNaturalLanguageStructuralPrompt,
} from '../../space3d/engine/space3dGenerative';
import type { Space3DProjectV1 } from '../../space3d/model/types';
import type { TranslationKey } from '../../i18n/catalogs';

export type Space3DArchetype =
  | 'frame'
  | 'truss'
  | 'tower'
  | 'dome'
  | 'bridge'
  | 'industrial-shed';

const clampFinite = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

export interface Space3DGenerativeModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onApply: (project: Space3DProjectV1) => void;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

/**
 * Previsualizador isométrico SVG en 2.5D.
 * Proyecta los nudos (x, y, z) a coordenadas de pantalla y dibuja las barras
 * para dar feedback visual inmediato antes de volcar la estructura al lienzo 3D.
 */
function Space3DWireframePreview({ project }: { readonly project: Space3DProjectV1 }) {
  const { nodes, members } = project;

  const { pathData, nodePoints, bounds } = useMemo(() => {
    if (nodes.length === 0) {
      return { pathData: '', nodePoints: [], bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10, minZ: 0, maxZ: 10 } };
    }

    // Proyección isométrica estándar:
    // x_iso = (x - z) * cos(30°)
    // y_iso = -y + (x + z) * sin(30°)
    const cos30 = Math.cos(Math.PI / 6);
    const sin30 = Math.sin(Math.PI / 6);

    let minIsoX = Infinity;
    let maxIsoX = -Infinity;
    let minIsoY = Infinity;
    let maxIsoY = -Infinity;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    const projected = new Map<string, { isoX: number; isoY: number }>();

    for (const node of nodes) {
      const isoX = (node.x - node.z) * cos30;
      const isoY = -node.y + (node.x + node.z) * sin30;
      projected.set(node.id, { isoX, isoY });

      if (isoX < minIsoX) minIsoX = isoX;
      if (isoX > maxIsoX) maxIsoX = isoX;
      if (isoY < minIsoY) minIsoY = isoY;
      if (isoY > maxIsoY) maxIsoY = isoY;

      if (node.x < minX) minX = node.x;
      if (node.x > maxX) maxX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.y > maxY) maxY = node.y;
      if (node.z < minZ) minZ = node.z;
      if (node.z > maxZ) maxZ = node.z;
    }

    // Escalar para ajustar en viewBox [20, 20, 260, 160]
    const pad = 16;
    const viewW = 280 - 2 * pad;
    const viewH = 170 - 2 * pad;
    const spanIsoX = Math.max(0.01, maxIsoX - minIsoX);
    const spanIsoY = Math.max(0.01, maxIsoY - minIsoY);
    const scale = Math.min(viewW / spanIsoX, viewH / spanIsoY);

    const cx = (minIsoX + maxIsoX) / 2;
    const cy = (minIsoY + maxIsoY) / 2;
    const screenCx = 140;
    const screenCy = 85;

    const toScreen = (pt: { isoX: number; isoY: number }) => ({
      x: screenCx + (pt.isoX - cx) * scale,
      y: screenCy + (pt.isoY - cy) * scale,
    });

    let path = '';
    for (const m of members) {
      const p1 = projected.get(m.i);
      const p2 = projected.get(m.j);
      if (p1 && p2) {
        const s1 = toScreen(p1);
        const s2 = toScreen(p2);
        path += `M${s1.x.toFixed(1)},${s1.y.toFixed(1)} L${s2.x.toFixed(1)},${s2.y.toFixed(1)} `;
      }
    }

    const nPoints = nodes.map((n) => {
      const pt = projected.get(n.id);
      return pt ? toScreen(pt) : { x: screenCx, y: screenCy };
    });

    return {
      pathData: path,
      nodePoints: nPoints,
      bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    };
  }, [nodes, members]);

  const dimX = (bounds.maxX - bounds.minX).toFixed(1);
  const dimY = (bounds.maxY - bounds.minY).toFixed(1);
  const dimZ = (bounds.maxZ - bounds.minZ).toFixed(1);

  return (
    <div className="space3d-wireframe-container" aria-label="Previsualización isométrica de la estructura">
      <svg
        viewBox="0 0 280 170"
        className="space3d-wireframe-svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="space3d-wire-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="280" height="170" fill="url(#space3d-wire-glow)" rx="6" />

        {/* Barras estructurales */}
        <path
          d={pathData}
          fill="none"
          stroke="var(--sc-color-brand-primary, #3b82f6)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* Nudos */}
        {nodePoints.map((pt, idx) => (
          <circle
            // eslint-disable-next-line react/no-array-index-key
            key={idx}
            cx={pt.x.toFixed(1)}
            cy={pt.y.toFixed(1)}
            r="1.8"
            fill="var(--sc-color-text-primary, #ffffff)"
            opacity="0.9"
          />
        ))}
      </svg>
      <div className="space3d-wireframe-dims">
        <span>Dim: <b>{dimX}m</b> × <b>{dimZ}m</b> · H: <b>{dimY}m</b></span>
      </div>
    </div>
  );
}

export const Space3DGenerativeModal = ({
  open,
  onClose,
  onApply,
  t,
}: Space3DGenerativeModalProps) => {
  const [archetype, setArchetype] = useState<Space3DArchetype>('frame');
  const [promptText, setPromptText] = useState('');
  const [promptFeedback, setPromptFeedback] = useState<string | null>(null);

  // Parámetros Pórtico 3D
  const [frameBaysX, setFrameBaysX] = useState(2);
  const [frameBayWidthX, setFrameBayWidthX] = useState(5.0);
  const [frameStoriesY, setFrameStoriesY] = useState(2);
  const [frameStoryHeightY, setFrameStoryHeightY] = useState(3.2);
  const [frameBaysZ, setFrameBaysZ] = useState(2);
  const [frameBayDepthZ, setFrameBayDepthZ] = useState(5.0);
  const [frameBaseSupport, setFrameBaseSupport] = useState<'fixed' | 'pinned'>('fixed');
  const [frameRoofLoad, setFrameRoofLoad] = useState(25);

  // Parámetros Celosía 3D
  const [trussSpanX, setTrussSpanX] = useState(12.0);
  const [trussHeightY, setTrussHeightY] = useState(2.0);
  const [trussWidthZ, setTrussWidthZ] = useState(2.5);
  const [trussPanels, setTrussPanels] = useState(4);
  const [trussLoad, setTrussLoad] = useState(20);

  // Parámetros Torre 3D
  const [towerHeight, setTowerHeight] = useState(15.0);
  const [towerBaseWidth, setTowerBaseWidth] = useState(4.0);
  const [towerTopWidth, setTowerTopWidth] = useState(1.5);
  const [towerTiers, setTowerTiers] = useState(4);
  const [towerWindLoad, setTowerWindLoad] = useState(20);

  // Parámetros Cúpula 3D
  const [domeRadius, setDomeRadius] = useState(6.0);
  const [domeHeight, setDomeHeight] = useState(3.0);
  const [domeSectors, setDomeSectors] = useState(8);
  const [domeRings, setDomeRings] = useState(3);
  const [domeLoad, setDomeLoad] = useState(12);

  // Parámetros Puente 3D
  const [bridgeSpanX, setBridgeSpanX] = useState(20.0);
  const [bridgeWidthZ, setBridgeWidthZ] = useState(4.0);
  const [bridgeHeightY, setBridgeHeightY] = useState(3.0);
  const [bridgePanels, setBridgePanels] = useState(5);
  const [bridgeDeckLoad, setBridgeDeckLoad] = useState(25);

  // Parámetros Nave Industrial 3D
  const [shedSpanX, setShedSpanX] = useState(14.0);
  const [shedEaveHeightY, setShedEaveHeightY] = useState(4.5);
  const [shedRidgeHeightY, setShedRidgeHeightY] = useState(6.5);
  const [shedBaysZ, setShedBaysZ] = useState(3);
  const [shedBaySpacingZ, setShedBaySpacingZ] = useState(5.0);
  const [shedRoofLoad, setShedRoofLoad] = useState(15);
  const [shedWindLoadX, setShedWindLoadX] = useState(12);

  const promptInputId = useId();

  // Interpretación de lenguaje natural
  const handleApplyPrompt = (customText?: string) => {
    const textToParse = customText ?? promptText;
    if (!textToParse.trim()) return;

    const parsed = parseNaturalLanguageStructuralPrompt(textToParse);
    if (!parsed.recognized) {
      setPromptFeedback(t('space3d.promptUnrecognized' as TranslationKey));
      return;
    }
    if (parsed.archetype === 'truss') {
      setPromptFeedback(t('space3d.trussUnsupported' as TranslationKey));
      return;
    }
    setArchetype(parsed.archetype);

    if (parsed.archetype === 'frame') {
      if (parsed.params.storiesY) setFrameStoriesY(clampFinite(Number(parsed.params.storiesY), 1, 6));
      if (parsed.params.baysX) setFrameBaysX(clampFinite(Number(parsed.params.baysX), 1, 5));
      if (parsed.params.baySize || parsed.params.span) setFrameBayWidthX(clampFinite(Number(parsed.params.baySize ?? parsed.params.span), 1, 30));
      if (parsed.params.height) setFrameStoryHeightY(clampFinite(Number(parsed.params.height), 1, 10));
      if (parsed.params.load) setFrameRoofLoad(clampFinite(Number(parsed.params.load), 0, 500));
      if (parsed.params.baseSupport === 'fixed' || parsed.params.baseSupport === 'pinned') {
        setFrameBaseSupport(parsed.params.baseSupport);
      }
    } else if (parsed.archetype === 'tower') {
      if (parsed.params.height) setTowerHeight(clampFinite(Number(parsed.params.height), 4, 80));
      if (parsed.params.load) setTowerWindLoad(clampFinite(Number(parsed.params.load), 0, 300));
    } else if (parsed.archetype === 'dome') {
      if (parsed.params.radius) setDomeRadius(clampFinite(Number(parsed.params.radius), 2, 40));
      if (parsed.params.height) setDomeHeight(clampFinite(Number(parsed.params.height), 1, 30));
      if (parsed.params.load) setDomeLoad(clampFinite(Number(parsed.params.load), 0, 200));
    } else if (parsed.archetype === 'bridge') {
      if (parsed.params.span) setBridgeSpanX(clampFinite(Number(parsed.params.span), 6, 60));
      if (parsed.params.width) setBridgeWidthZ(clampFinite(Number(parsed.params.width), 2, 15));
      if (parsed.params.height) setBridgeHeightY(clampFinite(Number(parsed.params.height), 1.5, 12));
      if (parsed.params.load) setBridgeDeckLoad(clampFinite(Number(parsed.params.load), 0, 400));
      if (parsed.params.bays) setBridgePanels(clampFinite(Number(parsed.params.bays), 2, 15));
    } else if (parsed.archetype === 'industrial-shed') {
      if (parsed.params.span) setShedSpanX(clampFinite(Number(parsed.params.span), 6, 40));
      if (parsed.params.height) setShedRidgeHeightY(clampFinite(Number(parsed.params.height), shedEaveHeightY + 0.5, 18));
      if (parsed.params.load) setShedRoofLoad(clampFinite(Number(parsed.params.load), 0, 200));
      const parsedBaysZ = parsed.params.baysZ
        ? clampFinite(Number(parsed.params.baysZ), 1, 10)
        : shedBaysZ;
      if (parsed.params.baysZ) setShedBaysZ(parsedBaysZ);
      if (parsed.params.lengthZ) {
        setShedBaySpacingZ(clampFinite(Number(parsed.params.lengthZ) / parsedBaysZ, 3, 12));
      }
    } else if (parsed.archetype === 'truss') {
      if (parsed.params.span) setTrussSpanX(clampFinite(Number(parsed.params.span), 4, 50));
      if (parsed.params.height) setTrussHeightY(clampFinite(Number(parsed.params.height), 0.5, 10));
      if (parsed.params.load) setTrussLoad(clampFinite(Number(parsed.params.load), 0, 500));
      if (parsed.params.bays) setTrussPanels(clampFinite(Number(parsed.params.bays), 2, 20));
    }

    setPromptFeedback(parsed.summary);
  };

  const previewState = useMemo<{ project: Space3DProjectV1 | null; error: string | null }>(() => {
    try {
      const project = archetype === 'frame'
        ? generateSpace3DFrame({
          baysX: frameBaysX, bayWidthX: frameBayWidthX, storiesY: frameStoriesY, storyHeightY: frameStoryHeightY,
          baysZ: frameBaysZ, bayDepthZ: frameBayDepthZ, baseSupport: frameBaseSupport, gravityLoadPerNode: frameRoofLoad,
        })
        : archetype === 'truss'
          ? generateSpace3DTruss({ spanX: trussSpanX, heightY: trussHeightY, widthZ: trussWidthZ, panels: trussPanels, loadAtTopNodes: trussLoad })
          : archetype === 'tower'
            ? generateSpace3DTower({ totalHeight: towerHeight, baseWidth: towerBaseWidth, topWidth: towerTopWidth, tiers: towerTiers, topWindLoad: towerWindLoad })
            : archetype === 'dome'
              ? generateSpace3DDome({ radius: domeRadius, height: domeHeight, sectors: domeSectors, rings: domeRings, verticalLoad: domeLoad })
              : archetype === 'bridge'
                ? generateSpace3DBridge({ spanX: bridgeSpanX, widthZ: bridgeWidthZ, heightY: bridgeHeightY, panels: bridgePanels, deckLoad: bridgeDeckLoad })
                : generateSpace3DIndustrialShed({
                  spanX: shedSpanX, eaveHeightY: shedEaveHeightY, ridgeHeightY: shedRidgeHeightY, baysZ: shedBaysZ,
                  baySpacingZ: shedBaySpacingZ, roofLoad: shedRoofLoad, windLoadX: shedWindLoadX,
                });
      return { project, error: null };
    } catch (error) {
      return { project: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [
    archetype,
    frameBaysX, frameBayWidthX, frameStoriesY, frameStoryHeightY, frameBaysZ, frameBayDepthZ, frameBaseSupport, frameRoofLoad,
    trussSpanX, trussHeightY, trussWidthZ, trussPanels, trussLoad,
    towerHeight, towerBaseWidth, towerTopWidth, towerTiers, towerWindLoad,
    domeRadius, domeHeight, domeSectors, domeRings, domeLoad,
    bridgeSpanX, bridgeWidthZ, bridgeHeightY, bridgePanels, bridgeDeckLoad,
    shedSpanX, shedEaveHeightY, shedRidgeHeightY, shedBaysZ, shedBaySpacingZ, shedRoofLoad, shedWindLoadX,
  ]);

  const previewModel = previewState.project;

  const handleApply = () => {
    if (!previewModel) return;
    onApply(previewModel);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}
      title={t('space3d.generatorTitle' as TranslationKey) || 'Generador de Estructuras 3D'}
      description={t('space3d.generatorDesc' as TranslationKey) || 'Genera geometrías paramétricas completas para cálculo estático 3D.'}
      footer={
        <div className="space3d-inline-actions" style={{ width: '100%', justifyContent: 'space-between' }}>
          <button type="button" className="space3d-button" onClick={onClose}>
            {t('space3d.cancelEdit')}
          </button>
          <button type="button" className="space3d-button space3d-button--primary" onClick={handleApply} disabled={!previewModel}>
            <Sparkles size={16} aria-hidden="true" />
            <span>{t('space3d.generateAndApply' as TranslationKey) || 'Generar Estructura'}</span>
          </button>
        </div>
      }
    >
      <div className="space3d-generative-dialog">
        {/* Barra Generativa por Prompt de Lenguaje Natural */}
        <div className="space3d-generative-prompt-bar">
          <div className="space3d-prompt-input-wrapper">
            <Wand2 size={16} className="space3d-prompt-icon" aria-hidden="true" />
            <input
              id={promptInputId}
              type="text"
              className="space3d-prompt-input"
              placeholder={t('space3d.promptPlaceholder' as TranslationKey) || 'Describe tu estructura: ej. "Edificio 3 pisos 2 vanos de 5m" o "Torre 18m"'}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyPrompt(e.currentTarget.value);
                }
              }}
            />
            <button
              type="button"
              className="space3d-prompt-submit-btn"
              onClick={() => handleApplyPrompt()}
              title="Interpretar y aplicar parámetros"
            >
              <span>{t('space3d.interpretPrompt' as TranslationKey) || 'Interpretar'}</span>
            </button>
          </div>

          {/* Chips de sugerencias rápidas */}
          <div className="space3d-prompt-suggestions" role="group" aria-label="Sugerencias de estructuras">
            {[
              { label: 'Pórtico 3 Pisos', prompt: 'Edificio 3 pisos 2 vanos de 5m carga 25 kN' },
              { label: 'Torre Antena 18m', prompt: 'Torre de 18 metros con viento de 30 kN' },
              { label: 'Cúpula Reticular', prompt: 'Cúpula de 8 metros de radio y 4m de altura' },
              { label: 'Puente 20m', prompt: 'Puente espacial de 20 metros con 5 paneles' },
              { label: 'Nave Industrial', prompt: 'Nave industrial de 16m de luz y 4 vanos' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="space3d-prompt-chip"
                onClick={() => {
                  setPromptText(chip.prompt);
                  handleApplyPrompt(chip.prompt);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {promptFeedback ? (
            <div className="space3d-prompt-feedback" role="status">
              <Sparkles size={13} aria-hidden="true" />
              <span>{promptFeedback}</span>
            </div>
          ) : null}
        </div>

        {/* Selector de Arquetipo */}
        <div className="space3d-generative-tabs" role="group" aria-label="Arquetipo estructural">
          <button
            type="button"
            aria-pressed={archetype === 'frame'}
            className={`space3d-archetype-tab ${archetype === 'frame' ? 'is-active' : ''}`}
            onClick={() => setArchetype('frame')}
          >
            <Building2 size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeFrame' as TranslationKey) || 'Pórtico 3D'}</span>
          </button>
          <button
            type="button"
            aria-pressed={false}
            className="space3d-archetype-tab"
            disabled
            title={t('space3d.trussUnsupported' as TranslationKey)}
          >
            <Box size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeTruss' as TranslationKey) || 'Celosía 3D'}</span>
          </button>
          <button
            type="button"
            aria-pressed={archetype === 'tower'}
            className={`space3d-archetype-tab ${archetype === 'tower' ? 'is-active' : ''}`}
            onClick={() => setArchetype('tower')}
          >
            <TowerControl size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeTower' as TranslationKey) || 'Torre 3D'}</span>
          </button>
          <button
            type="button"
            aria-pressed={archetype === 'dome'}
            className={`space3d-archetype-tab ${archetype === 'dome' ? 'is-active' : ''}`}
            onClick={() => setArchetype('dome')}
          >
            <Sparkles size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeDome' as TranslationKey) || 'Cúpula 3D'}</span>
          </button>
          <button
            type="button"
            aria-pressed={archetype === 'bridge'}
            className={`space3d-archetype-tab ${archetype === 'bridge' ? 'is-active' : ''}`}
            onClick={() => setArchetype('bridge')}
          >
            <GitBranch size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeBridge' as TranslationKey) || 'Puente 3D'}</span>
          </button>
          <button
            type="button"
            aria-pressed={archetype === 'industrial-shed'}
            className={`space3d-archetype-tab ${archetype === 'industrial-shed' ? 'is-active' : ''}`}
            onClick={() => setArchetype('industrial-shed')}
          >
            <Warehouse size={18} aria-hidden="true" />
            <span>{t('space3d.archetypeShed' as TranslationKey) || 'Nave Ind.'}</span>
          </button>
        </div>

        {/* Panel de parámetros y vista previa */}
        <div className="space3d-generative-columns">
          <div className="space3d-generative-form">
            {archetype === 'frame' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-bx">
                    {t('space3d.frameBaysX' as TranslationKey) || 'Vanos en X'}
                  </label>
                  <input
                    id="gen-frame-bx"
                    type="number"
                    min={1}
                    max={5}
                    value={frameBaysX}
                    onChange={(e) => setFrameBaysX(clampFinite(Number(e.target.value), 1, 5))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-wx">
                    {t('space3d.frameBayWidthX' as TranslationKey) || 'Ancho vano X (m)'}
                  </label>
                  <input
                    id="gen-frame-wx"
                    type="number"
                    step={0.5}
                    min={1}
                    max={30}
                    value={frameBayWidthX}
                    onChange={(e) => setFrameBayWidthX(clampFinite(Number(e.target.value), 1, 30))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-sy">
                    {t('space3d.frameStoriesY' as TranslationKey) || 'Niveles en Y'}
                  </label>
                  <input
                    id="gen-frame-sy"
                    type="number"
                    min={1}
                    max={6}
                    value={frameStoriesY}
                    onChange={(e) => setFrameStoriesY(clampFinite(Number(e.target.value), 1, 6))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-hy">
                    {t('space3d.frameStoryHeightY' as TranslationKey) || 'Altura entrepiso (m)'}
                  </label>
                  <input
                    id="gen-frame-hy"
                    type="number"
                    step={0.2}
                    min={1}
                    max={10}
                    value={frameStoryHeightY}
                    onChange={(e) => setFrameStoryHeightY(clampFinite(Number(e.target.value), 1, 10))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-bz">
                    {t('space3d.frameBaysZ' as TranslationKey) || 'Vanos en Z'}
                  </label>
                  <input
                    id="gen-frame-bz"
                    type="number"
                    min={1}
                    max={5}
                    value={frameBaysZ}
                    onChange={(e) => setFrameBaysZ(clampFinite(Number(e.target.value), 1, 5))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-wz">
                    {t('space3d.frameBayDepthZ' as TranslationKey) || 'Profundidad vano Z (m)'}
                  </label>
                  <input
                    id="gen-frame-wz"
                    type="number"
                    step={0.5}
                    min={1}
                    max={30}
                    value={frameBayDepthZ}
                    onChange={(e) => setFrameBayDepthZ(clampFinite(Number(e.target.value), 1, 30))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-sup">
                    {t('space3d.supportType' as TranslationKey) || 'Apoyos base'}
                  </label>
                  <select
                    id="gen-frame-sup"
                    value={frameBaseSupport}
                    onChange={(e) => setFrameBaseSupport(e.target.value as 'fixed' | 'pinned')}
                  >
                    <option value="fixed">{t('space3d.supportFixed' as TranslationKey) || 'Empotrados (6 GDL)'}</option>
                    <option value="pinned">{t('space3d.supportPinned' as TranslationKey) || 'Articulados (3 GDL)'}</option>
                  </select>
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-frame-load">
                    {t('space3d.roofLoadPerNode' as TranslationKey) || 'Carga gravitatoria techo (kN)'}
                  </label>
                  <input
                    id="gen-frame-load"
                    type="number"
                    step={5}
                    min={0}
                    max={500}
                    value={frameRoofLoad}
                    onChange={(e) => setFrameRoofLoad(clampFinite(Number(e.target.value), 0, 500))}
                  />
                </div>
              </div>
            )}

            {archetype === 'truss' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-truss-span">
                    {t('space3d.trussSpanX' as TranslationKey) || 'Luz total X (m)'}
                  </label>
                  <input
                    id="gen-truss-span"
                    type="number"
                    step={1}
                    min={4}
                    max={50}
                    value={trussSpanX}
                    onChange={(e) => setTrussSpanX(clampFinite(Number(e.target.value), 4, 50))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-truss-h">
                    {t('space3d.trussHeightY' as TranslationKey) || 'Peralte / Altura Y (m)'}
                  </label>
                  <input
                    id="gen-truss-h"
                    type="number"
                    step={0.2}
                    min={0.5}
                    max={10}
                    value={trussHeightY}
                    onChange={(e) => setTrussHeightY(clampFinite(Number(e.target.value), 0.5, 10))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-truss-w">
                    {t('space3d.trussWidthZ' as TranslationKey) || 'Ancho transversal Z (m)'}
                  </label>
                  <input
                    id="gen-truss-w"
                    type="number"
                    step={0.5}
                    min={1}
                    max={20}
                    value={trussWidthZ}
                    onChange={(e) => setTrussWidthZ(clampFinite(Number(e.target.value), 1, 20))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-truss-panels">
                    {t('space3d.trussPanels' as TranslationKey) || 'Número de paneles'}
                  </label>
                  <input
                    id="gen-truss-panels"
                    type="number"
                    min={2}
                    max={20}
                    value={trussPanels}
                    onChange={(e) => setTrussPanels(clampFinite(Number(e.target.value), 2, 20))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-truss-load">
                    {t('space3d.trussLoad' as TranslationKey) || 'Carga en nudos superiores (kN)'}
                  </label>
                  <input
                    id="gen-truss-load"
                    type="number"
                    step={5}
                    min={0}
                    max={500}
                    value={trussLoad}
                    onChange={(e) => setTrussLoad(clampFinite(Number(e.target.value), 0, 500))}
                  />
                </div>
              </div>
            )}

            {archetype === 'tower' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-tower-h">
                    {t('space3d.towerHeight' as TranslationKey) || 'Altura total (m)'}
                  </label>
                  <input
                    id="gen-tower-h"
                    type="number"
                    step={1}
                    min={4}
                    max={80}
                    value={towerHeight}
                    onChange={(e) => setTowerHeight(clampFinite(Number(e.target.value), 4, 80))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-tower-bw">
                    {t('space3d.towerBaseWidth' as TranslationKey) || 'Ancho en la base (m)'}
                  </label>
                  <input
                    id="gen-tower-bw"
                    type="number"
                    step={0.5}
                    min={1}
                    max={25}
                    value={towerBaseWidth}
                    onChange={(e) => setTowerBaseWidth(clampFinite(Number(e.target.value), 1, 25))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-tower-tw">
                    {t('space3d.towerTopWidth' as TranslationKey) || 'Ancho en la cúspide (m)'}
                  </label>
                  <input
                    id="gen-tower-tw"
                    type="number"
                    step={0.5}
                    min={0.5}
                    max={15}
                    value={towerTopWidth}
                    onChange={(e) => setTowerTopWidth(clampFinite(Number(e.target.value), 0.5, 15))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-tower-tiers">
                    {t('space3d.towerTiers' as TranslationKey) || 'Tramos / Niveles'}
                  </label>
                  <input
                    id="gen-tower-tiers"
                    type="number"
                    min={2}
                    max={15}
                    value={towerTiers}
                    onChange={(e) => setTowerTiers(clampFinite(Number(e.target.value), 2, 15))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-tower-wind">
                    {t('space3d.towerWindLoad' as TranslationKey) || 'Carga lateral de viento (kN)'}
                  </label>
                  <input
                    id="gen-tower-wind"
                    type="number"
                    step={5}
                    min={0}
                    max={300}
                    value={towerWindLoad}
                    onChange={(e) => setTowerWindLoad(clampFinite(Number(e.target.value), 0, 300))}
                  />
                </div>
              </div>
            )}

            {archetype === 'dome' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-dome-r">
                    {t('space3d.domeRadius' as TranslationKey) || 'Radio en la base (m)'}
                  </label>
                  <input
                    id="gen-dome-r"
                    type="number"
                    step={0.5}
                    min={2}
                    max={40}
                    value={domeRadius}
                    onChange={(e) => setDomeRadius(clampFinite(Number(e.target.value), 2, 40))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-dome-h">
                    {t('space3d.domeHeight' as TranslationKey) || 'Flecha / Altura (m)'}
                  </label>
                  <input
                    id="gen-dome-h"
                    type="number"
                    step={0.5}
                    min={1}
                    max={30}
                    value={domeHeight}
                    onChange={(e) => setDomeHeight(clampFinite(Number(e.target.value), 1, 30))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-dome-sec">
                    {t('space3d.domeSectors' as TranslationKey) || 'Sectores angulares'}
                  </label>
                  <input
                    id="gen-dome-sec"
                    type="number"
                    min={4}
                    max={24}
                    value={domeSectors}
                    onChange={(e) => setDomeSectors(clampFinite(Number(e.target.value), 4, 24))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-dome-rings">
                    {t('space3d.domeRings' as TranslationKey) || 'Anillos concéntricos'}
                  </label>
                  <input
                    id="gen-dome-rings"
                    type="number"
                    min={2}
                    max={10}
                    value={domeRings}
                    onChange={(e) => setDomeRings(clampFinite(Number(e.target.value), 2, 10))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-dome-load">
                    {t('space3d.domeLoad' as TranslationKey) || 'Carga vertical por nudo (kN)'}
                  </label>
                  <input
                    id="gen-dome-load"
                    type="number"
                    step={2}
                    min={0}
                    max={200}
                    value={domeLoad}
                    onChange={(e) => setDomeLoad(clampFinite(Number(e.target.value), 0, 200))}
                  />
                </div>
              </div>
            )}

            {archetype === 'bridge' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-bridge-span">
                    {t('space3d.bridgeSpan' as TranslationKey) || 'Luz libre X (m)'}
                  </label>
                  <input
                    id="gen-bridge-span"
                    type="number"
                    step={1}
                    min={6}
                    max={60}
                    value={bridgeSpanX}
                    onChange={(e) => setBridgeSpanX(clampFinite(Number(e.target.value), 6, 60))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-bridge-w">
                    {t('space3d.bridgeWidth' as TranslationKey) || 'Ancho calzada Z (m)'}
                  </label>
                  <input
                    id="gen-bridge-w"
                    type="number"
                    step={0.5}
                    min={2}
                    max={15}
                    value={bridgeWidthZ}
                    onChange={(e) => setBridgeWidthZ(clampFinite(Number(e.target.value), 2, 15))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-bridge-h">
                    {t('space3d.bridgeHeight' as TranslationKey) || 'Altura cercha Y (m)'}
                  </label>
                  <input
                    id="gen-bridge-h"
                    type="number"
                    step={0.5}
                    min={1.5}
                    max={12}
                    value={bridgeHeightY}
                    onChange={(e) => setBridgeHeightY(clampFinite(Number(e.target.value), 1.5, 12))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-bridge-panels">
                    {t('space3d.bridgePanels' as TranslationKey) || 'Paneles longitudinales'}
                  </label>
                  <input
                    id="gen-bridge-panels"
                    type="number"
                    min={2}
                    max={15}
                    value={bridgePanels}
                    onChange={(e) => setBridgePanels(clampFinite(Number(e.target.value), 2, 15))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-bridge-load">
                    {t('space3d.bridgeLoad' as TranslationKey) || 'Carga tablero por nudo (kN)'}
                  </label>
                  <input
                    id="gen-bridge-load"
                    type="number"
                    step={5}
                    min={0}
                    max={400}
                    value={bridgeDeckLoad}
                    onChange={(e) => setBridgeDeckLoad(clampFinite(Number(e.target.value), 0, 400))}
                  />
                </div>
              </div>
            )}

            {archetype === 'industrial-shed' && (
              <div className="space3d-field-grid">
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-span">
                    {t('space3d.shedSpan' as TranslationKey) || 'Luz libre pórtico X (m)'}
                  </label>
                  <input
                    id="gen-shed-span"
                    type="number"
                    step={1}
                    min={6}
                    max={40}
                    value={shedSpanX}
                    onChange={(e) => setShedSpanX(clampFinite(Number(e.target.value), 6, 40))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-eave">
                    {t('space3d.shedEaveHeight' as TranslationKey) || 'Altura alero Y (m)'}
                  </label>
                  <input
                    id="gen-shed-eave"
                    type="number"
                    step={0.5}
                    min={3}
                    max={12}
                    value={shedEaveHeightY}
                    onChange={(e) => setShedEaveHeightY(clampFinite(Number(e.target.value), 3, 12))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-ridge">
                    {t('space3d.shedRidgeHeight' as TranslationKey) || 'Altura cumbrera Y (m)'}
                  </label>
                  <input
                    id="gen-shed-ridge"
                    type="number"
                    step={0.5}
                    min={shedEaveHeightY + 0.5}
                    max={18}
                    value={shedRidgeHeightY}
                    onChange={(e) => setShedRidgeHeightY(clampFinite(Number(e.target.value), shedEaveHeightY + 0.5, 18))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-bays">
                    {t('space3d.shedBays' as TranslationKey) || 'Vanos longitudinales Z'}
                  </label>
                  <input
                    id="gen-shed-bays"
                    type="number"
                    min={1}
                    max={10}
                    value={shedBaysZ}
                    onChange={(e) => setShedBaysZ(clampFinite(Number(e.target.value), 1, 10))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-spacing">
                    {t('space3d.shedSpacing' as TranslationKey) || 'Distancia entre pórticos (m)'}
                  </label>
                  <input
                    id="gen-shed-spacing"
                    type="number"
                    step={0.5}
                    min={3}
                    max={12}
                    value={shedBaySpacingZ}
                    onChange={(e) => setShedBaySpacingZ(clampFinite(Number(e.target.value), 3, 12))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-load">
                    {t('space3d.shedRoofLoad' as TranslationKey) || 'Carga techo (kN)'}
                  </label>
                  <input
                    id="gen-shed-load"
                    type="number"
                    step={5}
                    min={0}
                    max={200}
                    value={shedRoofLoad}
                    onChange={(e) => setShedRoofLoad(clampFinite(Number(e.target.value), 0, 200))}
                  />
                </div>
                <div className="space3d-field">
                  <label className="space3d-field-label" htmlFor="gen-shed-wind">
                    {t('space3d.towerWindLoad' as TranslationKey) || 'Viento barlovento (kN)'}
                  </label>
                  <input
                    id="gen-shed-wind"
                    type="number"
                    step={2}
                    min={0}
                    max={200}
                    value={shedWindLoadX}
                    onChange={(e) => setShedWindLoadX(clampFinite(Number(e.target.value), 0, 200))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha: Previsualización isométrica viva y estadísticas */}
          <div className="space3d-generative-preview">
            <div className="space3d-preview-header">
              <Sparkles size={15} aria-hidden="true" />
              <span>{t('space3d.previewWireframe' as TranslationKey) || 'Previsualización Isométrica'}</span>
            </div>

            {previewModel ? (
              <>
                <Space3DWireframePreview project={previewModel} />
                <div className="space3d-preview-stats">
                  <div className="space3d-stat-pill"><span>{t('space3d.nodes')}</span><strong>{previewModel.nodes.length}</strong></div>
                  <div className="space3d-stat-pill"><span>{t('space3d.members')}</span><strong>{previewModel.members.length}</strong></div>
                  <div className="space3d-stat-pill"><span>{t('space3d.loads')}</span><strong>{previewModel.nodalLoads.length}</strong></div>
                  <div className="space3d-stat-pill"><span>{t('space3d.dofCount')}</span><strong>{previewModel.nodes.length * 6}</strong></div>
                </div>
                <div className="space3d-preview-info">
                  <span>{previewModel.name}</span>
                  <span className="space3d-preview-note">
                    {t('space3d.previewNote' as TranslationKey) || 'Estructura lista para cálculo matricial 3D de 6 GDL por nudo.'}
                  </span>
                  <span className="space3d-preview-note">
                    {t('space3d.generatorAssumption')}
                  </span>
                </div>
              </>
            ) : (
              <div className="space3d-notice" role="alert">
                {previewState.error ?? 'No se pudo generar una previsualización segura.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
};
