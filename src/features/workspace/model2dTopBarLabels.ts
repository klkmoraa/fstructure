import type { TranslationKey } from '../../i18n/catalogs';
import type { ProjectModel } from '../../types';
import { SOLVER_2D } from '../../design-system/moduleIdentity';
import { SINGLE_WORK_LABEL, singleWorkTool } from '../../shared/project/workScope';
import type { ProjectModelContextValue } from '../../store/ProjectModelContext';
import type { WorkspaceTopBarLabels } from './WorkspaceTopBar';

/** Rótulos de la barra superior del Modelo 2D. */
export const model2dTopBarLabels = (
  t: (key: TranslationKey) => string,
  language: ProjectModel['settings']['language'],
  project: ProjectModel,
  storageIssue: ProjectModelContextValue['storageIssue'],
): WorkspaceTopBarLabels => ({
  // Un cálculo individual lo dice en la barra: no está enlazado con 3D ni Diseño.
  solverName: singleWorkTool(project) ? `${language === 'es' ? 'Individual' : 'Single'} · ${SINGLE_WORK_LABEL.model2d[language]}` : `FS-A01 · ${SOLVER_2D.name}`,
  project: t('topbar.currentProject'),
  home: t('navigation.home'),
  editProject: t('project.name'),
  saveProject: t('topbar.saveProject'),
  cancel: t('topbar.cancelProject'),
  storageReady: t('storage.local'),
  storageRecovered: t('storage.recoveredShort'),
  // `storageIssue` no es sólo «no pude guardar»: `ProjectProvider` lo usa
  // también para una recuperación desde el respaldo, una carga fallida,
  // un conflicto de revisión y una biblioteca degradada. Rotularlos todos
  // «Error al guardar» informa de la operación equivocada —una
  // recuperación con éxito se leía como un fallo de guardado—, y el
  // catálogo ya tiene la palabra corta de cada caso.
  storageIssue: storageIssue === 'recovered' ? t('storage.recoveredShort')
    : storageIssue === 'load-failed' ? t('storage.loadFailedShort')
    : storageIssue === 'conflict' ? t('storage.conflictShort')
    : storageIssue === 'repository-degraded' ? t('storage.repositoryShort')
    : t('storage.failedShort'),
  analysisReady: t('analysis.statusReady'),
  analysisRunning: t('analysis.running'),
  analysisResolved: t('analysis.statusResolved'),
  analysisFailed: t('analysis.statusError'),
  undo: t('history.undo'),
  redo: t('history.redo'),
  analyze: t('analysis.run'),
  results: t('results.outputs'),
  calculationExperience: t('inspector.calculationExperience'),
  actions: t('toolbar.primary'),
});
