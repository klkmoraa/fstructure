import type { ModelDemandSnapshot } from '../../../design/elements/modelResultSnapshot';
import type { ColumnDraft } from './columnProposal';
import { COLUMN_DEFAULTS } from './columnProposal';
import type { FlexureDraft } from './flexureModel';
import { FLEXURE_DEFAULTS } from './flexureModel';
import type { LinkedPieceOrigin } from './LinkedPieceOrigin';

export type LinkedPieceTransfer = { readonly element: 'column' | 'flexure'; readonly fields: Record<string, string>; readonly origin: LinkedPieceOrigin };

const kgcm2 = (mpa: number) => String(Number((mpa * 10.197162129779).toFixed(2)));
const cm = (mm: number) => String(Number((mm / 10).toFixed(2)));
const raw = (value: number) => String(Number(value.toFixed(4)));

/** Sign and local axis conversion is explicit; copied fields remain raw editable strings. */
export function linkedPieceTransfer(snapshot: ModelDemandSnapshot, target: 'column' | 'flexure', base?: Record<string, string>): LinkedPieceTransfer {
  const member = snapshot.member;
  const { actions } = snapshot;
  if (target === 'column') {
    if (member.family !== 'column' || member.section.shape === 'other' || !member.section.fcMpa || member.section.fcMpa <= 0) throw new Error('La columna no tiene sección sólida compatible y concreto numérico confirmado.');
    if (member.section.shape === 'circular' && (!member.section.widthMm || member.section.widthMm !== member.section.depthMm)) throw new Error('El diámetro de la columna circular no está confirmado.');
    const is3d = snapshot.source.kind === 'model3d';
    const dimensions = member.section.shape === 'circular'
      ? { shape: 'circular', diameter: cm(member.section.widthMm!) }
      : { shape: 'rectangular', width: cm(member.section.widthMm!), depth: cm(member.section.depthMm!) };
    // Modelo 2D define N positivo a tensión. El solucionador 3D también expone N<0 a compresión.
    // En la sección del catálogo 3D, local z (global X) es el eje fuerte: Mz→X; local y (global Z): My→Y.
    const momentX = actions.mzKnm;
    const momentY = is3d ? actions.myKnm : 0;
    const shearX = is3d ? actions.vzKn : 0;
    const shearY = actions.vyKn;
    const fields = { ...COLUMN_DEFAULTS, ...base, ...dimensions, fc: kgcm2(member.section.fcMpa), axial: raw(-actions.nKn), momentX: raw(momentX), momentY: raw(momentY), shearX: raw(shearX), shearY: raw(shearY), length: raw(member.lengthM) } satisfies ColumnDraft;
    const copiedFields = Object.fromEntries(['shape', ...(member.section.shape === 'circular' ? ['diameter'] : ['width', 'depth']), 'fc', 'axial', 'momentX', 'momentY', 'shearX', 'shearY', 'length'].map((key) => [key, fields[key as keyof ColumnDraft]]));
    return { element: target, fields, origin: { version: 1, snapshot, copiedFields } };
  }
  if (member.family !== 'beam' || member.section.shape !== 'rectangular' || !member.section.widthMm || !member.section.depthMm || !member.section.fcMpa) throw new Error('La flexión enlazada admite vigas rectangulares sólidas con concreto numérico confirmado.');
  const moment = snapshot.source.kind === 'model2d' ? actions.mzKnm : actions.mzKnm;
  const fields = { ...FLEXURE_DEFAULTS, ...base, width: cm(member.section.widthMm), height: cm(member.section.depthMm), fc: kgcm2(member.section.fcMpa), moment: raw(moment) } satisfies FlexureDraft;
  const copiedFields = Object.fromEntries(['width', 'height', 'fc', 'moment'].map((key) => [key, fields[key as keyof FlexureDraft]]));
  return { element: target, fields, origin: { version: 1, snapshot, copiedFields } };
}
