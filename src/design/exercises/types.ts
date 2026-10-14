import type { DesignCodeId } from '../elements/codes';
import type { QuantityKind, UnitSystem } from './units';

/** Valores capturados en unidades internas (mm, MPa, kN, kN·m…). `undefined` = vacío. */
export type ExerciseValues = Readonly<Record<string, number | undefined>>;

export interface ExerciseField {
  readonly id: string;
  /** Símbolo del libro: b, d, f′c, Mu… */
  readonly symbol: string;
  readonly label: string;
  readonly kind: QuantityKind;
  /** Diámetros de barra longitudinal o de estribo; el valor es el diámetro en mm. */
  readonly bars?: 'longitudinal' | 'transverse';
  readonly options?: readonly { readonly value: number; readonly label: string }[];
  readonly optional?: boolean;
  /** Mínimo en unidades internas (exclusivo si `positive`). */
  readonly positive?: boolean;
  readonly min?: number;
  readonly integer?: boolean;
  readonly hint?: string;
}

/** Una línea de la solución, como en el pizarrón: fórmula, sustitución y resultado. */
export interface StepLine {
  readonly formula?: string;
  readonly substitution?: string;
  readonly result?: { readonly symbol: string; readonly value: number; readonly kind: QuantityKind };
  readonly note?: string;
}

export interface ExerciseStep {
  readonly title: string;
  readonly lines: readonly StepLine[];
}

export interface ExerciseAnswer {
  readonly symbol: string;
  readonly label: string;
  readonly value: number;
  readonly kind: QuantityKind;
  /** Texto en lugar del número (p. ej. «4 #6»). */
  readonly text?: string;
}

export interface ExerciseCheck {
  readonly label: string;
  readonly status: 'pass' | 'fail' | 'info';
  readonly detail: string;
  readonly reference?: string;
}

export type ExerciseFigure =
  | { readonly type: 'section'; readonly widthMm: number; readonly heightMm: number; readonly flange?: { readonly widthMm: number; readonly thicknessMm: number };
    readonly layers: readonly { readonly fromTopMm: number; readonly count: number; readonly diameterMm: number }[]; readonly blockDepthMm?: number; readonly neutralAxisMm?: number }
  | { readonly type: 'interaction'; readonly nominal: readonly { readonly p: number; readonly m: number }[]; readonly design: readonly { readonly p: number; readonly m: number }[];
    readonly point?: { readonly p: number; readonly m: number }; readonly ok?: boolean }
  | { readonly type: 'beam'; readonly support: 'simple' | 'cantilever'; readonly lengthM: number; readonly line: number; readonly point: number; readonly pointAtM: number;
    readonly stations: readonly { readonly x: number; readonly v: number; readonly m: number }[] }
  | { readonly type: 'footing'; readonly sideMm: number; readonly columnMm: number; readonly depthMm: number; readonly heightMm: number };

export interface ExerciseSolution {
  readonly steps: readonly ExerciseStep[];
  readonly answers: readonly ExerciseAnswer[];
  readonly checks: readonly ExerciseCheck[];
  readonly figure?: ExerciseFigure;
  readonly notes?: readonly string[];
}

export type ExerciseOutcome =
  | { readonly status: 'missing'; readonly missing: readonly string[] }
  | { readonly status: 'invalid'; readonly message: string }
  | { readonly status: 'solved'; readonly solution: ExerciseSolution };

export interface ExerciseContext {
  readonly code: DesignCodeId;
  readonly units: UnitSystem;
  /** Cantidad con unidad en el sistema elegido. */
  readonly q: (value: number, kind: QuantityKind) => string;
  /** Número sin unidad con `digits` decimales. */
  readonly n: (value: number, digits?: number) => string;
}

export interface ExerciseExample {
  readonly id: string;
  readonly label: string;
  readonly values: ExerciseValues;
}

export interface ExerciseProblem {
  readonly id: string;
  /** La incógnita: lo que el ejercicio pide encontrar. */
  readonly find: { readonly symbol: string; readonly label: string };
  /** Revisar (todos los datos) o diseñar (con incógnitas). */
  readonly mode: 'check' | 'design' | 'analysis';
  readonly fields: readonly ExerciseField[];
  readonly examples: readonly ExerciseExample[];
  statement(values: ExerciseValues, context: ExerciseContext): string;
  solve(values: ExerciseValues, context: ExerciseContext): ExerciseOutcome;
}

export interface ExerciseTopic {
  readonly id: string;
  /** Capítulo del índice («Flexión», «Cortante»…). */
  readonly chapter: string;
  readonly title: string;
  readonly summary: string;
  readonly problems: readonly ExerciseProblem[];
  /** Pieza completa del taller que amplía el tema. */
  readonly piece?: 'beam' | 'column' | 'footing' | 'flexure' | 'section';
}
