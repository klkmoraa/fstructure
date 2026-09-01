import { Check, CloudOff, Crosshair, ZoomIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import type { Tool } from '../../types';
import type { TranslationKey } from '../../i18n/catalogs';
import { unitLabel } from '../../engine/units';
import './instrument.css';

const TOOL_LABELS: Record<Tool, TranslationKey> = {
  select: 'toolbar.select', pan: 'toolbar.pan', node: 'toolbar.node', member: 'toolbar.member', support: 'toolbar.support', pointLoad: 'toolbar.pointLoad', distributedLoad: 'toolbar.distributedLoad', moment: 'toolbar.moment', dimension: 'toolbar.dimension', cut: 'toolbar.cut', split: 'toolbar.split', delete: 'toolbar.delete',
};

/**
 * Franja de estado del editor.
 *
 * Es la ÚNICA lectura de coordenada, escala y conteos del producto: el lienzo
 * mantiene esos nodos como fuente pero no los pinta, así que aquí no se repite
 * nada, se centraliza. El orden de la franja es también su orden de sacrificio:
 * cuando el ancho no alcanza, lo primero que se retira es lo que el dispositivo
 * no puede producir —una coordenada de puntero en una pantalla táctil— y lo
 * último es el estado de guardado.
 */
export const Instrument = () => {
  const { project, storageIssue, storageMessage } = useProjectModel();
  const { analysis, isAnalyzing } = useProjectAnalysis();
  const { activeTool } = useWorkspaceUI();
  const { t } = useI18n();
  const [canvasReadout, setCanvasReadout] = useState(`X — · Y — ${unitLabel(project.settings.units, 'length')}`);
  const [canvasScale, setCanvasScale] = useState('—');

  useEffect(() => {
    let coordinateObserver: MutationObserver | null = null;
    let scaleObserver: MutationObserver | null = null;
    const sync = () => {
      const coordinate = document.querySelector<HTMLOutputElement>('.canvas-coordinate-output');
      const scale = document.querySelector<HTMLOutputElement>('.canvas-scale-output');
      if (!coordinate || !scale) return false;
      const read = () => {
        setCanvasReadout(coordinate.textContent?.trim() || `X — · Y — ${unitLabel(project.settings.units, 'length')}`);
        setCanvasScale(scale.textContent?.trim() || '—');
      };
      read();
      coordinateObserver?.disconnect();
      scaleObserver?.disconnect();
      coordinateObserver = new MutationObserver(read);
      scaleObserver = new MutationObserver(read);
      coordinateObserver.observe(coordinate, { childList: true, characterData: true, subtree: true });
      scaleObserver.observe(scale, { childList: true, characterData: true, subtree: true });
      return true;
    };
    if (sync()) return () => { coordinateObserver?.disconnect(); scaleObserver?.disconnect(); };
    const documentObserver = new MutationObserver(() => { if (sync()) documentObserver.disconnect(); });
    documentObserver.observe(document.body, { childList: true, subtree: true });
    return () => { documentObserver.disconnect(); coordinateObserver?.disconnect(); scaleObserver?.disconnect(); };
  }, [project.settings.units]);

  const issue = storageIssue === 'load-failed' || storageIssue === 'save-failed' || storageIssue === 'repository-degraded' || storageIssue === 'conflict';
  const state = issue ? t('storage.failedShort') : t('storage.local');
  const solved = analysis?.success === true;
  const analysisState = isAnalyzing ? t('analysis.running') : solved ? t('analysis.statusResolved') : t('analysis.statusReady');

  return <footer className="instrument" aria-label={t('canvas.viewStatus')}>
    <span className="instrument__coordinates" title={t('canvas.coordinates')}><Crosshair size={13} />{canvasReadout}</span>
    <span className="instrument__scale" title={t('canvas.scale')}><ZoomIn size={13} />{canvasScale}</span>
    <span className="instrument__counts" title={t('inspector.nodes')}><b>{project.nodes.length}</b> N</span>
    <span className="instrument__counts" title={t('inspector.members')}><b>{project.members.length}</b> B</span>
    <span className="instrument__counts" title={t('inspector.loadsTab')}><b>{project.nodalLoads.length + project.memberLoads.length}</b> C</span>
    <span className="instrument__tool">{t(TOOL_LABELS[activeTool])}</span>
    <span className={issue ? 'instrument__storage is-issue' : 'instrument__storage'} title={storageMessage ?? state}>{issue ? <CloudOff size={13} /> : <Check size={13} />}<span className="instrument__word">{state}</span></span>
    <span className={solved ? 'instrument__analysis is-solved' : 'instrument__analysis'} title={analysisState}>{analysisState}</span>
  </footer>;
};
