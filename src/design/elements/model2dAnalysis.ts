import { analyzeProject } from '../../engine/solver';
import { evaluateDeformationAt, evaluateDiagramAt } from '../../engine/diagram';
import type { MemberResult, ProjectModel } from '../../types';
import type { StructureAnalysisOutcome } from './structure';

export interface Model2dAnalysisRequest {
  readonly model: ProjectModel;
  readonly cases: readonly { readonly solverId: string; readonly label: string }[];
}
type Diagram = Pick<MemberResult, 'length' | 'startOffset' | 'diagramSegments' | 'diagramJumps' | 'deformationSegments'>;
export type Model2dAnalysisPacket =
  | { readonly ok: false; readonly error: string }
  | {
      readonly ok: true;
      readonly cases: readonly {
        readonly nodeDisplacements: readonly (readonly [number, number, number])[];
        readonly members: readonly (Diagram | null)[];
      }[];
    };

/** Mensaje puro: coeficientes de diagramas y desplazamientos, sin funciones ni resultado de diseño. */
export function analyzeModel2dCases({ model, cases }: Model2dAnalysisRequest): Model2dAnalysisPacket {
  const results: Extract<Model2dAnalysisPacket, { ok: true }>['cases'][number][] = [];
  for (const item of cases) {
    const run = analyzeProject(
      model,
      { id: `design-${item.solverId}`, name: item.label, factors: { [item.solverId]: 1 } },
      { includeEducationTrace: false },
    );
    if (!run.success)
      return {
        ok: false,
        error: `El Modelo 2D no se pudo resolver en «${item.label}»: ${run.issues.find((issue) => issue.severity === 'error')?.message ?? 'revisa apoyos y conexiones'}.`,
      };
    const byId = new Map(run.memberResults.map((r) => [r.memberId, r]));
    const displacements = new Map(run.nodeResults.map((r) => [r.nodeId, [r.ux, r.uy, r.rz] as const]));
    results.push({
      nodeDisplacements: model.nodes.map((n) => displacements.get(n.id) ?? [0, 0, 0]),
      members: model.members.map((m) => {
        const r = byId.get(m.id);
        return r
          ? {
              length: r.length,
              startOffset: r.startOffset,
              diagramSegments: r.diagramSegments,
              diagramJumps: r.diagramJumps,
              deformationSegments: r.deformationSegments,
            }
          : null;
      }),
    });
  }
  return { ok: true, cases: results };
}

/** Las funciones lectoras se reconstruyen en el hilo que consume el paquete. */
export function hydrateModel2dCases(packet: Model2dAnalysisPacket): StructureAnalysisOutcome {
  if (!packet.ok) return packet;
  return {
    ok: true,
    cases: packet.cases.map((item) => ({
      nodeDisplacements: item.nodeDisplacements,
      at(memberIndex, x) {
        const r = item.members[memberIndex];
        if (!r) return { axial: 0, shear: 0, moment: 0, u: 0, v: 0 };
        const length = r.diagramSegments.at(-1)?.x1 ?? r.length;
        const local = Math.min(length, Math.max(0, x - (r.startOffset ?? 0)));
        const point = evaluateDiagramAt(r.diagramSegments, r.diagramJumps, local, local <= 1e-12 ? 'right' : 'left');
        const deformation = evaluateDeformationAt(r.deformationSegments, local);
        return {
          axial: point?.axial ?? 0,
          shear: point?.shear ?? 0,
          moment: point?.moment ?? 0,
          u: deformation?.u ?? 0,
          v: deformation?.v ?? 0,
        };
      },
    })),
  };
}
