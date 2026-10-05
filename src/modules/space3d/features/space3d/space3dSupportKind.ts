import type { Space3DRestraints } from '../../space3d/model/types';
import type { TranslationKey } from '../../i18n/catalogs';

export type Space3DSupportKind = 'free' | 'pinned' | 'fixed' | 'custom';

export const space3DSupportKind = (restraints: Space3DRestraints): Space3DSupportKind => {
  const translation = restraints.ux && restraints.uy && restraints.uz;
  const rotation = restraints.rx || restraints.ry || restraints.rz;
  const count = Object.values(restraints).filter(Boolean).length;
  if (count === 0) return 'free';
  if (count === 6) return 'fixed';
  if (translation && !rotation) return 'pinned';
  return 'custom';
};

export const SPACE3D_SUPPORT_RESTRAINTS: Record<Exclude<Space3DSupportKind, 'custom'>, Space3DRestraints> = {
  free: { ux: false, uy: false, uz: false, rx: false, ry: false, rz: false },
  pinned: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
  fixed: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
};

/** Nombre corto para listas y el HUD; un apoyo mixto se llama «parcial». */
export const SPACE3D_SUPPORT_LABEL_KEYS: Record<Space3DSupportKind, TranslationKey> = {
  free: 'space3d.supportPresetFree',
  pinned: 'space3d.supportPresetPinned',
  fixed: 'space3d.supportPresetFixed',
  custom: 'space3d.supportPartial',
};
