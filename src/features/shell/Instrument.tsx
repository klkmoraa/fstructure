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
  return <footer className="instrument" aria-label={t('canvas.viewStatus')}>
    <span title={t('canvas.coordinates')}><Crosshair size={13} />{canvasReadout}</span><span title={t('canvas.scale')}><ZoomIn size={13} />{canvasScale}</span>
    <span title={t('inspector.nodes')}><b>{project.nodes.length}</b> N</span><span title={t('inspector.members')}><b>{project.members.length}</b> B</span><span title={t('inspector.loadsTab')}><b>{project.nodalLoads.length + project.memberLoads.length}</b> C</span>
    <span className="instrument__tool">{t(TOOL_LABELS[activeTool])}</span><span className={issue ? 'instrument__storage is-issue' : 'instrument__storage'} title={storageMessage ?? state}>{issue ? <CloudOff size={13} /> : <Check size={13} />}{state}</span>
    <span className={solved ? 'instrument__analysis is-solved' : 'instrument__analysis'}>{isAnalyzing ? t('analysis.running') : solved ? t('analysis.statusResolved') : t('analysis.statusReady')}</span>
  </footer>;
};
