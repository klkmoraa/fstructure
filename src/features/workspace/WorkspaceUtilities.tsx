import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Moon,
  MoreHorizontal,
  MoveDown,
  PanelRight,
  PencilRuler,
  RotateCcw,
  Sheet,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
  X,
} from 'lucide-react';
import { APP_VERSION } from '../../appVersion';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import { isCustomUnitSystemId, type UnitSystemId } from '../../foundation/units';
import { UNIT_SYSTEM_PROFILES, unitSystemLabel } from '../../engine/units';
import type { CalculationReportOptions } from '../../utils/calculationPdf';
import type { PdfPreviewArtifact } from '../pdf-preview/PdfPreviewDialog';
import { emitWorkspaceCommand } from './workspaceCommands';

const LazyPdfPreviewDialog = lazy(() => import('../pdf-preview/PdfPreviewDialog').then((module) => ({ default: module.PdfPreviewDialog })));

/**
 * One compact, always-reachable home for the workspace controls that do not
 * belong to a selected element. Keeping them out of the Inspector means the
 * latter can remain a contextual editor instead of becoming a junk drawer.
 */
export const WorkspaceUtilities = ({
  onOpenInspector,
  onOpenUnitsEditor,
}: {
  onOpenInspector: (trigger?: HTMLElement | null) => void;
  onOpenUnitsEditor?: (trigger?: HTMLElement | null) => void;
}) => {
  const { project, updateProjectView } = useProjectModel();
  const { analysis, ensureEducationTrace, selectedCombinationId } = useProjectAnalysis();
  const { theme, setTheme, setActiveTool } = useWorkspaceUI();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewArtifact | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setOpen(false);
        setUnitPickerOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      setUnitPickerOpen(false);
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

  const updateUnits = (units: UnitSystemId) => {
    updateProjectView((draft) => ({ ...draft, settings: { ...draft.settings, units } }));
    setUnitPickerOpen(false);
  };
  const openSurface = (command: 'open-datasheet' | 'open-view-settings') => {
    emitWorkspaceCommand(command);
    setOpen(false);
  };
  const openTool = (tool: 'pointLoad' | 'distributedLoad' | 'moment') => {
    setActiveTool(tool);
    setOpen(false);
  };
  const openCommand = (command: 'open-analysis-setup' | 'open-structural-bom' | 'open-model-doctor') => {
    emitWorkspaceCommand(command);
    setOpen(false);
  };
  const openAssistant = () => {
    emitWorkspaceCommand('open-local-assistant', { trigger: triggerRef.current });
    setOpen(false);
  };

  const themeLabel = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
  const unitOptions = UNIT_SYSTEM_PROFILES;
  const selectedUnit = isCustomUnitSystemId(project.settings.units)
    ? { id: project.settings.units, label: unitSystemLabel(project.settings.units) }
    : unitOptions.find((item) => item.id === project.settings.units) ?? unitOptions[0];
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
      <section className="workspace-utilities__section" aria-label={t('workspace.utilityModelSection')}>
        <span className="workspace-utilities__section-label">{t('workspace.utilityModelSection')}</span>
        <div className="workspace-utilities__actions">
          <button className="workspace-utilities__action is-featured" type="button" onClick={() => void openPdf()} disabled={preparingPdf}>
            <FileText size={18} aria-hidden="true" /><span><strong>{preparingPdf ? t('workspace.utilityPdfPreparing') : t('portable.previewLabel')}</strong><small>{t('workspace.utilityPdfDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={() => openSurface('open-datasheet')}>
            <Sheet size={17} aria-hidden="true" /><span><strong>{t('datasheet.title')}</strong><small>{t('workspace.utilityDatasheetDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={() => openCommand('open-structural-bom')}>
            <ClipboardList size={17} aria-hidden="true" /><span><strong>{t('workspace.utilityBom')}</strong><small>{t('workspace.utilityBomDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={(event) => { onOpenInspector(event.currentTarget); setOpen(false); }}>
            <PanelRight size={17} aria-hidden="true" /><span><strong>{t('inspector.open')}</strong><small>{t('workspace.utilityInspectorDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={() => openSurface('open-view-settings')}>
            <Eye size={17} aria-hidden="true" /><span><strong>{t('workspace.utilityLayers')}</strong><small>{t('workspace.utilityLayersDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={() => openCommand('open-model-doctor')}>
            <Stethoscope size={17} aria-hidden="true" /><span><strong>{t('workspace.utilityDoctor')}</strong><small>{t('workspace.utilityDoctorDescription')}</small></span>
          </button>
          <button className="workspace-utilities__action" type="button" onClick={openAssistant}>
            <Sparkles size={17} aria-hidden="true" /><span><strong>{t('workspace.utilityAssistant')}</strong><small>{t('workspace.utilityAssistantDescription')}</small></span>
          </button>
        </div>
      </section>
      <section className="workspace-utilities__section" aria-label={t('workspace.utilityLoadsSection')}>
        <div className="workspace-utilities__section-heading">
          <span className="workspace-utilities__section-label">{t('workspace.utilityLoadsSection')}</span>
          <button type="button" className="workspace-utilities__setup" onClick={() => openCommand('open-analysis-setup')}>
            <SlidersHorizontal size={15} aria-hidden="true" />{t('workspace.utilityLoadSetup')}
          </button>
        </div>
        <div className="workspace-utilities__load-actions" aria-label={t('toolbar.loads')}>
          <button type="button" onClick={() => openTool('pointLoad')}><MoveDown size={17} aria-hidden="true" /><span>{t('toolbar.pointLoad')}</span></button>
          <button type="button" onClick={() => openTool('distributedLoad')}><Sigma size={17} aria-hidden="true" /><span>{t('toolbar.distributedLoad')}</span></button>
          <button type="button" onClick={() => openTool('moment')}><RotateCcw size={17} aria-hidden="true" /><span>{t('toolbar.moment')}</span></button>
        </div>
      </section>
      <section className="workspace-utilities__units" aria-label={t('units.label')}>
        <div className="workspace-utilities__units-copy">
          <span>{t('units.label')}</span>
          <small>{t('workspace.utilityUnitsDescription')}</small>
        </div>
        <div className="workspace-utilities__unit-picker">
          <button
            type="button"
            className="workspace-utilities__unit-trigger"
            aria-haspopup="listbox"
            aria-expanded={unitPickerOpen}
            onClick={() => setUnitPickerOpen((current) => !current)}
          >{selectedUnit.label}<ChevronDown size={15} aria-hidden="true" /></button>
          {unitPickerOpen ? <div className="workspace-utilities__unit-options" role="listbox" aria-label={t('units.label')}>
            {unitOptions.map((unit) => <button
              key={unit.id}
              type="button"
              role="option"
              aria-selected={unit.id === project.settings.units}
              onClick={() => updateUnits(unit.id)}
            ><span>{unit.label}</span>{unit.id === project.settings.units ? <Check size={15} aria-hidden="true" /> : null}</button>)}
          </div> : null}
        </div>
        {onOpenUnitsEditor ? <button
          type="button"
          className="workspace-utilities__customize-units"
          onClick={(event) => {
            onOpenUnitsEditor(event.currentTarget);
            setOpen(false);
            setUnitPickerOpen(false);
          }}
        >
          <PencilRuler size={16} aria-hidden="true" />
          <span><strong>{t('workspace.utilityCustomizeUnits')}</strong><small>{t('workspace.utilityCustomizeUnitsDescription')}</small></span>
        </button> : null}
      </section>
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
