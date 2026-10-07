import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Moon,
  MoreHorizontal,
  MoveDown,
  PencilRuler,
  RotateCcw,
  Sheet,
  Sigma,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Sun,
} from 'lucide-react';
import { APP_VERSION } from '../../appVersion';
import { useI18n } from '../../i18n/useI18n';
import { useProjectAnalysis, useProjectModel, useWorkspaceUI } from '../../store/ProjectContext';
import { isCustomUnitSystemId, type UnitSystemId } from '../../foundation/units';
import { UNIT_SYSTEM_PROFILES, unitSystemLabel } from '../../engine/units';
import type { CalculationReportOptions } from '../../utils/calculationPdf';
import type { PdfPreviewArtifact } from '../pdf-preview/PdfPreviewDialog';
import { emitWorkspaceCommand } from './workspaceCommands';
import { OPEN_HELP_EVENT } from './WorkspaceHelp';
import './workspaceUtilities.css';

const LazyPdfPreviewDialog = lazy(() => import('../pdf-preview/PdfPreviewDialog').then((module) => ({ default: module.PdfPreviewDialog })));

/**
 * One compact, always-reachable home for the Model 2D controls that do not
 * belong to a selected element. Keeping them out of the Inspector means the
 * latter can remain a contextual editor instead of becoming a junk drawer.
 *
 * It belongs to the Model mode of FStructure: the other tools are isolated
 * workbenches reached from Home, and Design is the other mode of this same
 * workbench (top-bar switch).
 */
export const WorkspaceUtilities = ({
  onOpenUnitsEditor,
}: {
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
  const openTool = (tool: 'pointLoad' | 'distributedLoad' | 'moment') => {
    setActiveTool(tool);
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
  const run = (action: () => void) => () => { action(); setOpen(false); setUnitPickerOpen(false); };
  const item = (Icon: typeof FileText, label: string, onClick: () => void, extra?: { disabled?: boolean }) =>
    <button type="button" role="menuitem" className="workspace-utilities__item" onClick={onClick} disabled={extra?.disabled}>
      <Icon size={17} aria-hidden="true" /><span>{label}</span>
    </button>;
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
      <div className="workspace-utilities__list" role="menu">
        {item(FileText, preparingPdf ? t('workspace.utilityPdfPreparing') : t('portable.previewLabel'), () => void openPdf(), { disabled: preparingPdf })}
        {item(Sheet, t('datasheet.title'), run(() => emitWorkspaceCommand('open-datasheet')))}
        {item(ClipboardList, t('workspace.utilityBom'), run(() => emitWorkspaceCommand('open-structural-bom')))}
        {item(Stethoscope, t('workspace.utilityDoctor'), run(() => emitWorkspaceCommand('open-model-doctor')))}
        {item(Eye, t('workspace.utilityLayers'), run(() => emitWorkspaceCommand('open-view-settings')))}
        {item(Sparkles, t('workspace.utilityAssistant'), run(openAssistant))}
        {item(SlidersHorizontal, t('workspace.utilityLoadSetup'), run(() => emitWorkspaceCommand('open-analysis-setup')))}
      </div>
      <div className="workspace-utilities__group" role="group" aria-label={t('workspace.utilityLoadsSection')}>
        <span className="workspace-utilities__label">{t('workspace.utilityLoadsSection')}</span>
        <div className="workspace-utilities__chips" aria-label={t('toolbar.loads')}>
          <button type="button" onClick={() => openTool('pointLoad')}><MoveDown size={16} aria-hidden="true" />{t('toolbar.pointLoad')}</button>
          <button type="button" onClick={() => openTool('distributedLoad')}><Sigma size={16} aria-hidden="true" />{t('toolbar.distributedLoad')}</button>
          <button type="button" onClick={() => openTool('moment')}><RotateCcw size={16} aria-hidden="true" />{t('toolbar.moment')}</button>
        </div>
      </div>
      <div className="workspace-utilities__group" role="group" aria-label={t('units.label')}>
        <span className="workspace-utilities__label">{t('units.label')}</span>
        <div className="workspace-utilities__unit-picker">
          <button
            type="button"
            className="workspace-utilities__unit-trigger"
            aria-haspopup="listbox"
            aria-expanded={unitPickerOpen}
            onClick={() => setUnitPickerOpen((current) => !current)}
          >{selectedUnit.label}<ChevronDown size={15} aria-hidden="true" /></button>
          {unitPickerOpen ? <div className="workspace-utilities__unit-options" role="listbox" aria-label={t('units.label')}>
            {isCustomUnitSystemId(project.settings.units) ? <div className="workspace-utilities__unit-custom-active" role="presentation">
              <span>{selectedUnit.label}</span>
              <Check size={14} aria-hidden="true" />
            </div> : null}
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
        ><PencilRuler size={15} aria-hidden="true" />{t('workspace.utilityCustomizeUnits')}</button> : null}
      </div>
      <div className="workspace-utilities__footer">
        <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}{themeLabel}
        </button>
        <button type="button" className="workspace-utilities__phone-only" onClick={run(() => window.dispatchEvent(new Event(OPEN_HELP_EVENT)))}><CircleHelp size={16} aria-hidden="true" />{t('workspace.utilityHelp')}</button>
        <button type="button" onClick={run(() => emitWorkspaceCommand('export-svg'))}><Download size={16} aria-hidden="true" />SVG</button>
        <button type="button" onClick={run(() => emitWorkspaceCommand('export-png'))}><Download size={16} aria-hidden="true" />PNG</button>
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
