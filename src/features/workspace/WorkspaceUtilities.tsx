import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Download, FileText, Layers3, Moon, MoreHorizontal, PanelRight, Sheet, Sun, X } from 'lucide-react';
import { APP_VERSION } from '../../appVersion';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import type { UnitSystemId } from '../../foundation/units';
import type { CalculationReportOptions } from '../../utils/calculationPdf';
import type { PdfPreviewArtifact } from '../pdf-preview/PdfPreviewDialog';
import { emitWorkspaceCommand } from './workspaceCommands';

const LazyPdfPreviewDialog = lazy(() => import('../pdf-preview/PdfPreviewDialog').then((module) => ({ default: module.PdfPreviewDialog })));

/**
 * One compact, always-reachable home for the workspace controls that do not
 * belong to a selected element. Keeping them out of the Inspector means the
 * latter can remain a contextual editor instead of becoming a junk drawer.
 */
export const WorkspaceUtilities = ({ onOpenInspector }: { onOpenInspector: (trigger?: HTMLElement | null) => void }) => {
  const { project, updateProjectView } = useProjectModel();
  const { analysis, ensureEducationTrace, selectedCombinationId } = useProjectAnalysis();
  const { theme, setTheme } = useWorkspaceUI();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewArtifact | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const reportFor = async (selection: CalculationReportOptions = {}): Promise<PdfPreviewArtifact> => {
    const combination = project.combinations.find((item) => item.id === selectedCombinationId) ?? null;
    const scenarioName = combination?.name
      ?? project.loadCases.filter((item) => item.active).map((item) => item.name).join(' + ');
    const scenarioFactors = combination?.factors ?? Object.fromEntries(
      project.loadCases.filter((item) => item.active).map((item) => [item.id, 1]),
    );
    let reportAnalysis = analysis?.success ? analysis : null;
    if (!reportAnalysis) {
      const { analyzeProjectAuto } = await import('../../engine/pDelta');
      reportAnalysis = analyzeProjectAuto(project, combination, { includeEducationTrace: true });
    } else if (!reportAnalysis.educationTrace) {
      reportAnalysis = await ensureEducationTrace() ?? reportAnalysis;
    }
    if (!reportAnalysis.success) throw new Error('No se pudo resolver el modelo para generar la memoria PDF.');
    const { createCalculationReport } = await import('../../utils/calculationPdf');
    const report = await createCalculationReport(project, reportAnalysis, {
      appVersion: APP_VERSION,
      scenarioName,
      scenarioFactors,
      ...selection,
    });
    return {
      bytes: report.bytes,
      filename: report.filename,
      renderEngine: 'browser',
      solutionMethod: report.solutionMethod,
      methodAvailability: report.methodAvailability,
    };
  };

  const openPdf = async () => {
    setPreparingPdf(true);
    setExportError(null);
    try {
      setPdfPreview(await reportFor());
      setOpen(false);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t('portable.exportFailed'));
    } finally {
      setPreparingPdf(false);
    }
  };

  const downloadPdf = async (artifact: PdfPreviewArtifact) => {
    const { shareOrDownloadPortableBytes } = await import('../../utils/portableDownload');
    await shareOrDownloadPortableBytes(artifact.bytes, artifact.filename, 'application/pdf', project.name);
  };

  const updateUnits = (units: UnitSystemId) => updateProjectView((draft) => ({
    ...draft,
    settings: { ...draft.settings, units },
  }));
  const openSurface = (command: 'open-datasheet' | 'open-view-settings') => {
    emitWorkspaceCommand(command);
    setOpen(false);
  };

  const themeLabel = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  return <div className="workspace-utilities" ref={menuRef}>
    <button
      ref={triggerRef}
      type="button"
      className={'workspace-topbar__icon-button workspace-utilities__trigger' + (open ? ' is-active' : '')}
      onClick={() => setOpen((current) => !current)}
      aria-label={t('topbar.utilities')}
      title={t('topbar.utilities')}
      aria-expanded={open}
      aria-haspopup="dialog"
    ><MoreHorizontal size={19} aria-hidden="true" /></button>
    {open ? <section className="workspace-utilities__panel" role="dialog" aria-label={t('topbar.utilities')}>
      <header>
        <div><strong>{t('topbar.utilities')}</strong><span>{t('workspace.utilitiesSubtitle')}</span></div>
        <button type="button" onClick={() => setOpen(false)} aria-label={t('toolbar.close')}><X size={17} aria-hidden="true" /></button>
      </header>
      <div className="workspace-utilities__actions">
        <button type="button" onClick={() => void openPdf()} disabled={preparingPdf}>
          <FileText size={17} aria-hidden="true" /><span><strong>{preparingPdf ? t('workspace.utilityPdfPreparing') : t('portable.previewLabel')}</strong><small>{t('workspace.utilityPdfDescription')}</small></span>
        </button>
        <button type="button" onClick={() => openSurface('open-datasheet')}>
          <Sheet size={17} aria-hidden="true" /><span><strong>{t('datasheet.title')}</strong><small>{t('workspace.utilityDatasheetDescription')}</small></span>
        </button>
        <button type="button" onClick={(event) => { onOpenInspector(event.currentTarget); setOpen(false); }}>
          <PanelRight size={17} aria-hidden="true" /><span><strong>{t('inspector.open')}</strong><small>{t('workspace.utilityInspectorDescription')}</small></span>
        </button>
        <button type="button" onClick={() => openSurface('open-view-settings')}>
          <Layers3 size={17} aria-hidden="true" /><span><strong>{t('workspace.utilityLayers')}</strong><small>{t('workspace.utilityLayersDescription')}</small></span>
        </button>
      </div>
      <label className="workspace-utilities__units">
        <span>{t('units.label')}</span>
        <select value={project.settings.units} onChange={(event) => updateUnits(event.currentTarget.value as UnitSystemId)}>
          <option value="kN-m">kN · m</option>
          <option value="N-mm">N · mm</option>
          <option value="kgf-m">kgf · m</option>
          <option value="kip-ft">kip · ft</option>
        </select>
      </label>
      <div className="workspace-utilities__footer">
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />} {themeLabel}
        </button>
        <button type="button" onClick={() => { emitWorkspaceCommand('export-svg'); setOpen(false); }}><Download size={16} aria-hidden="true" /> SVG</button>
        <button type="button" onClick={() => { emitWorkspaceCommand('export-png'); setOpen(false); }}><Download size={16} aria-hidden="true" /> PNG</button>
      </div>
      {exportError ? <p className="workspace-utilities__error" role="alert">{exportError}</p> : null}
    </section> : null}
    {pdfPreview ? <Suspense fallback={null}><LazyPdfPreviewDialog
      artifact={pdfPreview}
      onClose={() => setPdfPreview(null)}
      onDownload={downloadPdf}
      onRebuild={reportFor}
    /></Suspense> : null}
  </div>;
};
