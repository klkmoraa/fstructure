import type { MemberModel, ProjectModel, StiffnessDefaults } from '../types';

/** A numerical reference, never a measured material/section in an unspecified exercise. */
export const STIFFNESS_REFERENCE = { E: 200e6, I: 8.333e-6, EI: 1666.6 } as const;

const positive = (value: number, field: string) => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${field}: debe ser positivo y finito.`);
};

export const validateStiffnessDefaults = (defaults: StiffnessDefaults): void => {
  if (!['EI', 'E', 'I'].includes(defaults.mode)) throw new Error('stiffnessDefaults.mode: constante desconocida.');
  positive(defaults.factor, 'stiffnessDefaults.factor');
  if (defaults.value !== undefined) positive(defaults.value, 'stiffnessDefaults.value');
};

export const supportsStiffness = (member: MemberModel, defaults: StiffnessDefaults): boolean =>
  member.type === 'frame' || (member.type === 'truss' && defaults.mode === 'E');

export const withMemberStiffness = (member: MemberModel, defaults: StiffnessDefaults, factor = defaults.factor): MemberModel => {
  validateStiffnessDefaults(defaults);
  positive(factor, 'stiffnessFactor');
  if (!supportsStiffness(member, defaults)) {
    const own = { ...member };
    delete own.stiffnessFactor;
    return own;
  }
  const value = (defaults.value ?? STIFFNESS_REFERENCE[defaults.mode]) * factor;
  positive(value, 'Rigidez resultante');
  const next = { ...member, stiffnessFactor: factor };
  if (defaults.mode === 'E') next.E = value;
  else next.I = defaults.mode === 'I' ? value : value / member.E;
  positive(next.E, 'E');
  if (member.type === 'frame') positive(next.I, 'I');
  if (defaults.mode === 'E') {
    delete next.materialId;
    next.materialOrigin = 'custom';
  } else {
    delete next.sectionId;
    next.sectionOrigin = 'custom';
  }
  return next;
};

/** Changes linked members only; enrolling all members is always explicit. */
export const setStiffnessDefaults = (project: ProjectModel, defaults: StiffnessDefaults | undefined, applyToAll = false): ProjectModel => {
  if (defaults) validateStiffnessDefaults(defaults);
  const next = structuredClone(project);
  if (defaults) next.settings.stiffnessDefaults = { ...defaults };
  else delete next.settings.stiffnessDefaults;
  next.members = next.members.map((member) => {
    if (!defaults) { delete member.stiffnessFactor; return member; }
    if (!applyToAll && member.stiffnessFactor === undefined) return member;
    return withMemberStiffness(member, defaults, applyToAll ? defaults.factor : member.stiffnessFactor);
  });
  return next;
};

export const validateMemberStiffness = (project: ProjectModel): void => {
  const defaults = project.settings.stiffnessDefaults;
  if (defaults) validateStiffnessDefaults(defaults);
  for (const member of project.members) {
    if (member.stiffnessFactor === undefined) continue;
    positive(member.stiffnessFactor, `${member.id}.stiffnessFactor`);
    if (!defaults || !supportsStiffness(member, defaults)) throw new Error(`${member.id}.stiffnessFactor: requiere una base compatible.`);
    const value = defaults.mode === 'EI' ? member.E * member.I : member[defaults.mode];
    const expected = (defaults.value ?? STIFFNESS_REFERENCE[defaults.mode]) * member.stiffnessFactor;
    if (!Number.isFinite(value) || !Number.isFinite(expected) || Math.abs(value - expected) > Math.abs(expected) * 1e-9) {
      throw new Error(`${member.id}.stiffnessFactor: los valores E/I no coinciden con la base.`);
    }
  }
};
