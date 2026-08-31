import { LocateFixed, Minus, Plus, X } from 'lucide-react';
import { useEffect, type Dispatch, type RefObject } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { IconButton } from '../../design-system/components/controls';
import type { ResultTab } from '../../store/ProjectContext';
import { CanvasLayers } from './CanvasLayers';
import { CanvasEvidenceRail } from './CanvasEvidenceRail';
import type { StackQuantity } from './diagramStack';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { formatFixed } from '../../utils/numberFormat';
import { onWorkspaceCommand } from '../workspace/workspaceCommands';

export interface CanvasChromeProps {
  placementInstruction: string | null;
  layers: EditorLayerState;
  dispatchLayers: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  analysisAvailable: boolean;
  snapEnabled: boolean;
  gridEnabled: boolean;
  coordinateReadoutRef: RefObject<HTMLOutputElement | null>;
  lengthLabel: string;
  scale: number;
  onCancelPlacement: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  stackActive?: boolean;
  stackAvailable?: boolean;
  stackQuantities?: readonly StackQuantity[];
  onStackToggle?: () => void;
  onStackQuantityToggle?: (quantity: StackQuantity) => void;
}

/** Presentation-only canvas controls. Camera and model mutations stay upstream. */
export const CanvasChrome = ({
  placementInstruction,
  layers,
  dispatchLayers,
  resultTab,
  setResultTab,
  analysisAvailable,
  snapEnabled,
  gridEnabled,
  coordinateReadoutRef,
  lengthLabel,
  scale,
  onCancelPlacement,
  onZoomIn,
  onZoomOut,
  onFit,
  stackActive,
  stackAvailable,
  stackQuantities,
  onStackToggle,
  onStackQuantityToggle,
}: CanvasChromeProps) => {
  const { t } = useI18n();

  useEffect(() => {
    return onWorkspaceCommand('fit-canvas', () => onFit());
  }, [onFit]);

  return <>
    {placementInstruction ? <div className="canvas-mode-badge placing-load" role="status" aria-live="polite" data-canvas-chrome="mode">
      <span className="canvas-action-instruction">{placementInstruction}</span>
      <IconButton size="sm" label={t('canvas.cancelPlacement')} onClick={onCancelPlacement}><X size={14} /></IconButton>
    </div> : null}
    <CanvasLayers layers={layers} dispatch={dispatchLayers} />
    <CanvasEvidenceRail layers={layers} dispatch={dispatchLayers} resultTab={resultTab} setResultTab={setResultTab} visible={analysisAvailable} stackActive={stackActive} stackAvailable={stackAvailable} stackQuantities={stackQuantities} onStackToggle={onStackToggle} onStackQuantityToggle={onStackQuantityToggle} />
    <div className="canvas-view-chips" role="status" aria-label={t('canvas.viewStatus')} data-canvas-chrome="view-status">
      <span className={snapEnabled ? 'active' : ''}>{snapEnabled ? t('canvas.snapOn') : t('canvas.snapOff')}</span>
      <span className={gridEnabled ? 'active' : ''}>{gridEnabled ? t('canvas.gridOn') : t('canvas.gridOff')}</span>
    </div>
    <div className="canvas-controls" role="group" aria-label={t('canvas.viewControls')} data-canvas-chrome="camera">
      <IconButton label={t('canvas.zoomIn')} title={t('canvas.zoomIn')} onClick={onZoomIn}><Plus size={18} /></IconButton>
      <IconButton label={t('canvas.zoomOut')} title={t('canvas.zoomOut')} onClick={onZoomOut}><Minus size={18} /></IconButton>
      <IconButton label={t('canvas.fit')} title={t('canvas.fit')} onClick={onFit}><LocateFixed size={18} /></IconButton>
    </div>
    <div className="sr-only" aria-live="polite">
      <output ref={coordinateReadoutRef} className="canvas-coordinate-output" aria-label={t('canvas.coordinates')}>X — · Y — {lengthLabel}</output>
      <output className="canvas-scale-output">{t('canvas.scale')} {formatFixed((scale / 85), 2)}×</output>
    </div>
  </>;
};
