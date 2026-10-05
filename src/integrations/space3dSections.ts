import type { ConcreteFrameSections, ConcreteSectionGroup } from '../data/concreteFrame';
import { designStructure, type StructureDesignOptions, type StructureDesignResult } from '../design/elements/structure';
import { calculateRectangularSection } from '../modules/space3d/space3d/model/sectionLibrary';
import type { Space3DProjectV1 } from '../modules/space3d/space3d/model/types';
import { space3dConcreteOf, space3dDesignAxes, space3dFramePlanes } from './space3dDesign';

/** Vigas de cada eje y nivel; las columnas compartidas se agrupan por entrepiso. Cada barra aparece una sola vez. */
export function space3dSectionGroups(model: Space3DProjectV1): ConcreteSectionGroup[] {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  const planes = space3dFramePlanes(model);
  const groups = new Map<string, ConcreteSectionGroup>();
  for (const member of model.members) {
    const a = nodes.get(member.i), b = nodes.get(member.j);
    if (!a || !b || (member.type && member.type !== 'frame') || !space3dConcreteOf(member).concrete) continue;
    const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y), dz = Math.abs(a.z - b.z);
    const column = dx < 1e-6 && dz < 1e-6 && dy > 1e-6;
    const beam = dy < 1e-6 && ((dx < 1e-6 && dz > 1e-6) || (dz < 1e-6 && dx > 1e-6));
    if (!column && !beam) continue;
    const plane = beam ? planes.find((p) => Math.abs((p.axis === 'z' ? a.z : a.x) - p.coordinate) < 1e-3 && Math.abs((p.axis === 'z' ? b.z : b.x) - p.coordinate) < 1e-3) : undefined;
    if (beam && !plane) continue;
    // La sección rectangular propuesta conserva el plano vertical de la viga.
    if (beam && (Math.abs(Math.sin(member.orientation.rollRadians)) > 1e-6 || Math.abs(member.orientation.localYReferenceGlobal[1]) < 0.999)) continue;
    const low = Math.min(a.y, b.y), high = Math.max(a.y, b.y);
    const id = column ? `column:${low.toFixed(5)}:${high.toFixed(5)}` : `beam:${plane!.id}:${high.toFixed(5)}`;
    const previous = groups.get(id);
    groups.set(id, {
      id, kind: column ? 'column' : 'beam', label: column ? `Columnas ${low}–${high} m` : `${plane!.label} · vigas a ${high} m`,
      memberIds: [...(previous?.memberIds ?? []), member.id], lengthM: (previous?.lengthM ?? 0) + Math.hypot(dx, dy, dz), width: 0, height: 0,
    });
  }
  return [...groups.values()];
}

/** Puente Diseño → modelo 3D: cambia sólo A, Iy, Iz, J e identidad de sección. Quien lo llama registra el historial del 3D. */
export function withSpace3dSections(model: Space3DProjectV1, sections: ConcreteFrameSections, assigned: readonly ConcreteSectionGroup[] = []): Space3DProjectV1 {
  const groups = space3dSectionGroups(model);
  const sizes = new Map(assigned.flatMap((g) => g.memberIds.map((id) => [id, { widthMm: g.width * 10, heightMm: g.height * 10 }] as const)));
  const roles = new Map(groups.flatMap((g) => g.memberIds.map((id) => [id, g.kind] as const)));
  for (const section of [...sizes.values(), sections.beam, sections.column]) {
    if (!(Number.isFinite(section.widthMm) && section.widthMm > 0 && Number.isFinite(section.heightMm) && section.heightMm > 0)) throw new Error('La sección propuesta debe tener dimensiones finitas y positivas.');
  }
  return { ...model, members: model.members.map((member) => {
    const kind = roles.get(member.id);
    if (!kind) return member;
    const size = sizes.get(member.id) ?? sections[kind];
    const { sectionId: _previous, shearArea: _shearArea, ...rest } = member;
    return { ...rest, ...calculateRectangularSection(size.widthMm / 1e3, size.heightMm / 1e3), sectionOrigin: 'custom' as const };
  }) };
}

/** Verifica todos los ejes con el modelo candidato completo; la columna común queda gobernada por ambos planos. */
export function designSpace3dSectionCandidate(model: Space3DProjectV1, options: StructureDesignOptions, braced: boolean): StructureDesignResult | { readonly ok: false; readonly errors: readonly string[] } {
  const axes = space3dDesignAxes(model);
  const results: StructureDesignResult[] = [];
  for (const axis of axes.axes) {
    const external = axes.source(axis.id);
    const source = external?.create({ braced });
    if (!source || external!.errors.length) return { ok: false, errors: external?.errors.length ? external.errors : ['No hay ejes diseñables.'] };
    const result = designStructure(source, { ...options, fcMpa: external!.fcMpa ?? options.fcMpa, includeSelfWeight: external!.includesSelfWeight });
    if (!result.ok) return result;
    results.push(result);
  }
  const first = results[0];
  if (!first) return { ok: false, errors: ['No hay ejes diseñables.'] };
  return { ...first, beams: results.flatMap((r) => r.beams), columns: results.flatMap((r) => r.columns), checks: results.flatMap((r) => r.checks),
    governingRatio: Math.max(...results.map((r) => r.governingRatio)), status: results.some((r) => r.status === 'fail') ? 'fail' : results.some((r) => r.status === 'warning') ? 'warning' : 'pass' };
}
