import type { AnalysisResult, ProjectModel } from '../types';

/** Immutable snapshot payload kept with a named analysis run. */
export interface AnalysisRunSnapshot {
  schemaVersion: 1;
  kind: 'fusionstructure-revision-snapshot';
  revisionId: string;
  capturedAt: string;
  project: ProjectModel;
  analysis: {
    result: AnalysisResult;
    projectSignature: string;
    resultDigest: string;
    scenarioId: string;
  } | null;
}

export interface AnalysisRunRecord {
  id: string;
  projectId: string;
  label: string;
  createdAt: string;
  snapshot: AnalysisRunSnapshot;
}
