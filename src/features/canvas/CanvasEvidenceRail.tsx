import type { Dispatch } from 'react';
import { useI18n } from '../../i18n/useI18n';
import type { ResultTab } from '../../store/ProjectContext';
import type { EditorLayerAction, EditorLayerState } from './editorLayers';
import { applyEvidenceLayerChoice, EVIDENCE_LAYERS, isEvidenceLayerActive } from './evidenceLayers';
import { STACK_QUANTITIES, STACK_SYMBOLS, type StackQuantity } from './diagramStack';

const stackLabelKeys: Readonly<Record<StackQuantity, 'results.axial' | 'results.shear' | 'results.moment'>> = {
  axial: 'results.axial', shear: 'results.shear', moment: 'results.moment',
};

/** Presentation-only result overlays, anchored directly to the canvas. */
export const CanvasEvidenceRail = ({
  layers,
  dispatch,
  resultTab,
  setResultTab,
  visible,
  stackActive = false,
  stackAvailable = false,
  stackQuantities = STACK_QUANTITIES,
  onStackToggle,
  onStackQuantityToggle,
}: {
  layers: EditorLayerState;
  dispatch: Dispatch<EditorLayerAction>;
  resultTab: ResultTab;
  setResultTab: (tab: ResultTab) => void;
  visible: boolean;
  stackActive?: boolean;
  stackAvailable?: boolean;
  stackQuantities?: readonly StackQuantity[];
  onStackToggle?: () => void;
  onStackQuantityToggle?: (quantity: StackQuantity) => void;
}) => {
  const { t } = useI18n();
  if (!visible) return null;
  return <div className="canvas-evidence-rail" role="group" aria-label={t('canvas.evidenceLayers')} data-canvas-chrome="evidence">
    {/* El riel publica las CINCO capas de evidencia. El mapa de demanda —la
        señal de fluencia— estaba excluido a mano y sólo se podía encender desde
        el menú de capas: la única lectura que dice si una barra alcanza su Fy
        era la única que no tenía ficha junto a N, V, M y la deformada. */}
    {EVIDENCE_LAYERS.map(({ id, labelKey, chipLabelKey }) => <button
      key={id}
      type="button"
      className={`canvas-evidence-layer canvas-evidence-layer--${id}`}
      aria-pressed={isEvidenceLayerActive(id, resultTab, layers)}
      /* La ficha se lee corta; el nombre completo de la capa sigue siendo el
         nombre accesible para que no dependa de la abreviatura. */
      aria-label={chipLabelKey ? t(labelKey) : undefined}
      data-evidence-layer={id}
      onClick={() => applyEvidenceLayerChoice(id, { resultTab, layers }, { setResultTab, dispatchLayers: dispatch })}
    >{t(chipLabelKey ?? labelKey)}</button>)}
    <button
      type="button"
      className="canvas-evidence-layer canvas-evidence-layer--stack"
      aria-pressed={stackActive}
      aria-label={t('canvas.evidenceStack')}
      disabled={!stackAvailable}
      data-evidence-layer="stack"
      onClick={onStackToggle}
    >ACM</button>
    {stackActive ? <div className="canvas-evidence-stack-choices" role="group" aria-label={t('canvas.evidenceStack')}>
      {STACK_QUANTITIES.map((quantity) => {
        const selected = stackQuantities.includes(quantity);
        return <button
          key={quantity}
          type="button"
          className="canvas-evidence-stack-choice"
          aria-label={t(stackLabelKeys[quantity])}
          aria-pressed={selected}
          disabled={selected && stackQuantities.length === 1}
          data-evidence-stack-quantity={quantity}
          onClick={() => onStackQuantityToggle?.(quantity)}
        >{STACK_SYMBOLS[quantity]}</button>;
      })}
    </div> : null}
  </div>;
};
