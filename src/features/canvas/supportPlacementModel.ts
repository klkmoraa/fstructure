import type { SupportDefinition, SupportType } from '../../types';
import { discardIncompatibleInlineSupportPrescribed } from '../../data/supportSemantics';

export type CanvasSupportPlacementType = Extract<SupportType, 'none' | 'pin' | 'roller' | 'fixed' | 'custom'>;

/** Construye el apoyo escrito por la paleta contextual del canvas. */
export const supportForCanvasPlacement = (
  previous: SupportDefinition,
  type: CanvasSupportPlacementType,
  angleDeg: number,
  presetId?: string,
): SupportDefinition => {
  const shared = { spring: previous.spring, prescribed: previous.prescribed };
  if (presetId === 'guide-horizontal') {
    return discardIncompatibleInlineSupportPrescribed({ ...shared, type: 'custom', restrainX: false, restrainY: true, restrainR: true });
  }
  if (presetId === 'guide-vertical') {
    return discardIncompatibleInlineSupportPrescribed({ ...shared, type: 'custom', restrainX: true, restrainY: false, restrainR: true });
  }
  if (presetId === 'spring') {
    return discardIncompatibleInlineSupportPrescribed({
      type: 'none',
      spring: { ...previous.spring, ky: previous.spring?.ky || 1000 },
    });
  }
  if (type === 'roller') return discardIncompatibleInlineSupportPrescribed({ ...shared, type, angleDeg: Number.isFinite(angleDeg) ? angleDeg : 90 });
  if (type === 'custom') {
    return discardIncompatibleInlineSupportPrescribed({
      ...shared,
      type,
      restrainX: previous.type === 'custom' ? previous.restrainX ?? false : false,
      restrainY: previous.type === 'custom' ? previous.restrainY ?? false : false,
      restrainR: previous.type === 'custom' ? previous.restrainR ?? false : false,
    });
  }
  return discardIncompatibleInlineSupportPrescribed({ ...shared, type });
};
