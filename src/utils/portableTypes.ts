import type { AnalysisResult, NumericQualityState, ProjectModel } from '../types';
import type { UnitSystemId } from '../foundation/units';

export const PORTABLE_PAYLOAD_FILENAME = 'fusionstructure-payload.json';
export const PORTABLE_PAYLOAD_MIME = 'application/vnd.fusionstructure.project+json';
export const PORTABLE_BUNDLE_MIME = 'application/vnd.fusionstructure.bundle+zip';

/**
 * Compatibility identifiers are read-only migration points. New exports never use them,
 * but existing local projects and previously generated files must remain recoverable.
 */
export const LEGACY_PORTABLE_PAYLOAD_FILENAME = 'structureco-payload.json';
export const LEGACY_PORTABLE_PAYLOAD_SUFFIX = '.structureco.json';
export const LEGACY_PORTABLE_BUNDLE_EXTENSION = '.structureco';

export const PORTABLE_FORMAT_VERSION = 1 as const;

export type PortablePayloadFormat = 'fusionstructure-portable' | 'structureco-portable';
export type PortableBundleFormat = 'fusionstructure-bundle' | 'structureco-bundle';

export interface PortableReportMetadata {
  projectName: string;
  scenarioName?: string;
  units: UnitSystemId;
  nodeCount: number;
  memberCount: number;
  loadCount: number;
  analysisSuccess: boolean;
  numericQuality: NumericQualityState;
  analysisMode: 'first-order' | 'p-delta';
  pDeltaExperimental: boolean;
}

export interface PortableProvenance {
  generatedBy: 'FusionStructure' | 'structureCo';
  source: 'native-export';
  generatedAt: string;
  appVersion: string;
  projectSchemaVersion: number;
  analysisIncluded: true;
}

export interface PortableChecksum {
  algorithm: 'SHA-256';
  value: string;
}

/** Exact, machine-readable project snapshot embedded in a human PDF. */
export interface PortablePayload {
  format: PortablePayloadFormat;
  formatVersion: typeof PORTABLE_FORMAT_VERSION;
  metadata: PortableReportMetadata;
  provenance: PortableProvenance;
  project: ProjectModel;
  analysis: AnalysisResult;
  checksum: PortableChecksum;
}

export type PdfImportKind = 'native' | 'external' | 'scanned';

export interface PdfInspection {
  kind: PdfImportKind;
  confidence: number;
  pageCount: number;
  text: string;
  textByPage: string[];
  payload?: PortablePayload;
  attachmentName?: string;
  warnings: string[];
  summary: {
    title: string;
    nodeCount?: number;
    memberCount?: number;
    loadCount?: number;
  };
}

export interface PortableBundleManifest {
  format: PortableBundleFormat;
  formatVersion: typeof PORTABLE_FORMAT_VERSION;
  createdAt: string;
  appVersion: string;
  projectName: string;
  payloadChecksum: string;
  files: {
    payload: 'portable/payload.json';
    project: 'project.json';
    analysis: 'analysis/result.json';
    report: 'report/calculation-report.pdf';
  };
}
