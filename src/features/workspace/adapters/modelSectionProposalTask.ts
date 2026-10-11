import { concreteFrameGroups, withConcreteSections } from '../../../data/concreteFrame';
import { model2dDesignSource } from '../../../design/elements/model2dSource';
import { space3dDesignAxes } from '../../../integrations/space3dDesign';
import { designSpace3dSectionCandidate, space3dSectionGroups, withSpace3dSections } from '../../../integrations/space3dSections';
import { proposeModelSections, type ProposalStep } from '../../design/workbench/frameProposal';
import { structureOptions, type FrameDraft } from '../../design/workbench/frameCalculation';
import type { DesignCodeId } from '../../../design/elements/codes';
import type { ProjectModel } from '../../../types';
import type { Space3DProjectV1 } from '../../../modules/space3d/space3d/model/types';
import type { ModelSection, ModelSectionsBridge } from '../../design/workbench/WorkbenchLayout';
import type { ConcreteSectionGroup } from '../../../data/concreteFrame';
export type ModelProposalRequest = { code: DesignCodeId; draft: FrameDraft; scopeMemberIds?: readonly string[] } & (
  | { kind: 'model2d'; model: ProjectModel }
  | { kind: 'model3d'; model: Space3DProjectV1 }
);
export function runModelSectionProposal(request: ModelProposalRequest, onStep: (step: ProposalStep) => void) {
  const groups = request.kind === 'model2d' ? concreteFrameGroups(request.model) : space3dSectionGroups(request.model);
  const mm = (s: ModelSection) => ({ widthMm: s.width * 10, heightMm: s.height * 10 });
  const variant = (beam: ModelSection, column: ModelSection, assigned?: readonly ConcreteSectionGroup[], scopeMemberIds?: readonly string[]) => {
    if (request.kind === 'model2d')
      return model2dDesignSource(withConcreteSections(request.model, { beam: mm(beam), column: mm(column) }, assigned, scopeMemberIds));
    const axes = space3dDesignAxes(withSpace3dSections(request.model, { beam: mm(beam), column: mm(column) }, assigned, scopeMemberIds));
    return axes.source(axes.axes[0]!.id);
  };
  const bridge: Pick<ModelSectionsBridge, 'groups' | 'beamLengthM' | 'columnLengthM' | 'variant' | 'evaluate'> = {
    groups,
    beamLengthM: groups.filter((g) => g.kind === 'beam').reduce((s, g) => s + g.lengthM, 0),
    columnLengthM: groups.filter((g) => g.kind === 'column').reduce((s, g) => s + g.lengthM, 0),
    variant,
    ...(request.kind === 'model3d'
      ? {
          evaluate: (
            code: DesignCodeId,
            draft: FrameDraft,
            beam: ModelSection,
            column: ModelSection,
          assigned?: readonly ConcreteSectionGroup[],
          scopeMemberIds?: readonly string[],
          ) => {
            const result = designSpace3dSectionCandidate(
              withSpace3dSections(request.model, { beam: mm(beam), column: mm(column) }, assigned, scopeMemberIds),
              structureOptions(code, draft),
              draft.braced === 'yes',
            );
            return result.ok ? { ok: true as const, result, frame: null } : result;
          },
        }
      : {}),
  };
  // The bridge kind is the authoritative model source. `model2d` names the
  // serializable request, while FrameDraft uses `model`; passing the request
  // discriminator through would make the design fall back to an empty frame.
  const draft: FrameDraft = { ...request.draft, source: request.kind === 'model2d' ? 'model' : 'model3d' };
  for (const step of proposeModelSections(request.code, draft, bridge, request.scopeMemberIds)) onStep(step);
}
