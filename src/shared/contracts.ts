import type * as React from 'react';

/**
 * La mesa de FStructure (`model2d`): el modelo 2D, el modelo 3D y el diseño son
 * modos de la misma mesa. Elementos finitos (FS-A03) se retiró de la app; los
 * estudios que hubiera guardados siguen intactos en el expediente del proyecto.
 */
export type ToolId = 'model2d';
export type Maturity = 'available' | 'experimental' | 'planned' | 'unavailable';

export interface ToolModuleDescriptor {
  id: ToolId;
  labelKey: string;
  maturity: Maturity;
  load(): Promise<React.ComponentType>;
  capabilities: readonly string[];
}

export interface AnalysisJobRequest<T> {
  jobId: string;
  tool: ToolId;
  sourceVersion: string;
  targetId: string;
  budget: AnalysisBudget;
  payload: T;
}

export interface AnalysisBudget {
  maxEstimatedBytes: number;
  softDeadlineMs: number;
}

export interface AnalysisQuality {
  conditionEstimate: number;
  linearResidual: number;
  equilibriumResidual: number;
  level: 'stable' | 'limited' | 'unreliable' | 'failed';
}

export interface SyncPatchV1 {
  entityKind: string;
  entityId: string;
  field: string;
  before: unknown;
  after: unknown;
  compatibility: 'exact' | 'requires-review' | 'unsupported';
}
