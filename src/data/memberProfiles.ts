import type { CustomMemberMaterial, CustomMemberSection, MemberModel } from '../types';
import { calculateParametricSection, normalizeSectionDefinition } from './personalSections';
import { findStandardMaterial } from './standardMaterials';
import { findStandardSection } from './standardSections';

const record = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('La definición debe ser un objeto.');
  return raw as Record<string, unknown>;
};
const nameOf = (raw: unknown) => {
  if (typeof raw !== 'string' || !raw.trim() || raw.trim().length > 80) throw new Error('El nombre debe tener entre 1 y 80 caracteres.');
  return raw.trim();
};
const numberOf = (raw: unknown, key: string, minimum = 0, strict = false) => {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || (strict ? raw <= minimum : raw < minimum)) throw new Error(`${key}: valor inválido.`);
  return raw;
};
export const normalizeCustomMaterial = (input: unknown): CustomMemberMaterial => {
  const raw = record(input);
  if (!['STEEL', 'CONCRETE', 'TIMBER', 'ALUMINUM', 'OTHER'].includes(String(raw.category))) throw new Error('Categoría de material inválida.');
  const poissonRatio = numberOf(raw.poissonRatio, 'ν', -1, true);
  if (poissonRatio >= .5) throw new Error('ν debe ser menor que 0.5.');
  const material: CustomMemberMaterial = { name: nameOf(raw.name), category: raw.category as CustomMemberMaterial['category'],
    poissonRatio, thermalExpansion: numberOf(raw.thermalExpansion, 'α') };
  for (const key of ['yieldStrength', 'ultimateStrength', 'compressiveStrength'] as const) {
    if (raw[key] !== undefined) material[key] = numberOf(raw[key], key, 0, true);
  }
  return material;
};
export const normalizeCustomSection = (input: unknown): CustomMemberSection => {
  const raw = record(input);
  return { name: nameOf(raw.name), definition: normalizeSectionDefinition(raw.definition) };
};
export const materialDefinitionOf = (member: MemberModel): CustomMemberMaterial | undefined => {
  if (member.customMaterial && member.materialOrigin !== 'catalog') return member.customMaterial;
  const catalog = member.materialId ? findStandardMaterial(member.materialId) : undefined;
  if (!catalog) return undefined;
  return { name: catalog.name.slice(0, 80), category: catalog.category, poissonRatio: catalog.poissonRatio, thermalExpansion: catalog.thermalExpansion,
    ...(catalog.category === 'CONCRETE' ? { compressiveStrength: catalog.yieldStrength } : { yieldStrength: catalog.yieldStrength }) };
};

export const thermalExpansionOf = (member: MemberModel | undefined, explicit?: number): number =>
  explicit ?? (member?.materialOrigin !== 'catalog' ? member?.customMaterial?.thermalExpansion : undefined) ?? 1.2e-5;

/** A stored geometry may remain as an editable draft after a deliberate A/I or constant edit. */
export const activeCustomSection = (member: Pick<MemberModel, 'customSection' | 'A' | 'I' | 'sectionOrigin'>) => {
  if (!member.customSection || member.sectionOrigin === 'catalog') return undefined;
  const properties = calculateParametricSection(member.customSection.definition);
  const matches = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9;
  return matches(properties.area, member.A) && matches(properties.inertiaX, member.I) ? member.customSection : undefined;
};

export const sectionDefinitionOf = (member: MemberModel): CustomMemberSection | undefined => {
  if (member.customSection && member.sectionOrigin !== 'catalog') return member.customSection;
  const s = member.sectionId ? findStandardSection(member.sectionId) : undefined;
  if (!s) return undefined;
  const base = { width: s.width, depth: s.depth };
  const thickness = s.webThickness ?? Math.min(s.width, s.depth) * .05;
  const definition = s.shapeType === 'RECT' ? { family: 'rectangle' as const, ...base }
    : s.shapeType === 'HSS_ROUND' ? { family: 'circular-tube' as const, outerDiameter: s.depth, thickness }
    : s.shapeType === 'HSS_RECT' ? { family: 'rectangular-box' as const, ...base, thickness }
    : s.shapeType === 'L' ? { family: 'angle' as const, ...base, thickness }
    : { family: (s.shapeType === 'C' ? 'channel' : 'symmetric-i') as 'channel' | 'symmetric-i', ...base,
      webThickness: thickness, flangeThickness: s.flangeThickness ?? thickness };
  return { name: s.name, definition };
};

export const withCustomSection = (member: MemberModel, raw: CustomMemberSection): MemberModel => {
  const section = normalizeCustomSection(raw); const properties = calculateParametricSection(section.definition);
  const next = { ...member, propertyProfile: 'custom' as const, customSection: section, sectionOrigin: 'custom' as const,
    A: properties.area, I: properties.inertiaX };
  delete next.sectionId; delete next.stiffnessFactor;
  return next;
};

export const withCustomMaterial = (member: MemberModel, raw: CustomMemberMaterial, properties: Pick<MemberModel, 'E'> & Pick<Partial<MemberModel>, 'G' | 'density'>): MemberModel => {
  const material = normalizeCustomMaterial(raw);
  numberOf(properties.E, 'E', 0, true);
  if (properties.G !== undefined) numberOf(properties.G, 'G', 0, true);
  if (properties.density !== undefined) numberOf(properties.density, 'ρ');
  const next = { ...member, ...properties, propertyProfile: 'custom' as const, customMaterial: material, materialOrigin: 'custom' as const };
  delete next.materialId;
  return next;
};
