/**
 * Floating On-Canvas Selection HUD for Space 3D.
 *
 * Provides immediate contextual readouts and rapid actions right on the 3D canvas
 * (both desktop and mobile) when an entity is selected.
 */
import { ArrowRight, Edit3, Spline, Trash2, Weight, X } from 'lucide-react';
import { Button, IconButton } from '../../../../design-system/components/controls';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DSelection } from '../../space3d/store/Space3DProjectContext';
import { formatSpace3DNumber } from './space3dNumberFormat';
import { SPACE3D_SUPPORT_LABEL_KEYS, space3DSupportKind } from './space3dSupportKind';
import { MemberGlyph, NodeGlyph, PointLoadGlyph } from '../../../../design-system/icons/structural';
import {
  deriveSpace3DMemberAxialAction,
  deriveSpace3DMemberMomentMagnitude,
  deriveSpace3DMemberShearMagnitude,
} from '../../space3d/view/resultSemantics';
import type { TranslationKey } from '../../i18n/catalogs';

export interface Space3DSelectionHUDProps {
  readonly selection: Space3DSelection;
  readonly project: Space3DProjectV1;
  readonly analysis: Space3DAnalysisResult | null;
  readonly onDeselect: () => void;
  readonly onOpenEditor: () => void;
  readonly onDelete: () => void;
  readonly onStartConnectMember?: (fromNodeId: string) => void;
  readonly onAddLoadToNode?: (nodeId: string) => void;
  readonly t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}

export const Space3DSelectionHUD = ({
  selection,
  project,
  analysis,
  onDeselect,
  onOpenEditor,
  onDelete,
  onStartConnectMember,
  onAddLoadToNode,
  t,
}: Space3DSelectionHUDProps) => {
  const num = (v: number) => formatSpace3DNumber(v, { significantDigits: 4 });

  if (selection.kind === 'node') {
    const node = project.nodes.find((item) => item.id === selection.id);
    if (!node) return null;

    const restraintCount = Object.values(node.restraints).filter(Boolean).length;
    const supportKind = space3DSupportKind(node.restraints);
    // Un apoyo mixto no tiene nombre corto: se dice exactamente qué restringe.
    const supportLabel = supportKind === 'custom'
      ? Object.entries(node.restraints).filter(([, active]) => active).map(([dof]) => dof).join(' · ')
      : t(SPACE3D_SUPPORT_LABEL_KEYS[supportKind]);

    // Nodal displacement if analysis is available
    const nodeResult = analysis?.nodeResults.find((item) => item.nodeId === node.id);

    return (
      <div className="space3d-hud-card" role="region" aria-label={`${t('space3d.node')} ${node.id}`}>
        <div className="space3d-hud-header">
          <div className="space3d-hud-title-group">
            <span className="space3d-hud-badge space3d-hud-badge--node" aria-hidden="true"><NodeGlyph size={16} /></span>
            <strong className="space3d-hud-id">{node.id}</strong>
            <span className="space3d-hud-chip">{supportLabel}</span>
          </div>
          <IconButton
            size="sm"
            className="space3d-hud-close"
            label={t('space3d.cancelEdit')}
            onClick={onDeselect}
          >
            <X size={15} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="space3d-hud-coordinates">
          <span>X: <b>{num(node.x)}</b> m</span>
          <span>Y: <b>{num(node.y)}</b> m</span>
          <span>Z: <b>{num(node.z)}</b> m</span>
        </div>

        {nodeResult && (
          <div className="space3d-hud-results">
            <div className="space3d-hud-result-item">
              <span>{t('space3d.hudDeflectionY')}:</span>
              <strong>{num(nodeResult.displacement.uy * 1000)} mm</strong>
            </div>
            {restraintCount > 0 && (
              <div className="space3d-hud-result-item">
                <span>{t('space3d.hudReactionY')}:</span>
                <strong>{num(nodeResult.reaction.uy)} kN</strong>
              </div>
            )}
          </div>
        )}

        <div className="space3d-hud-actions">
          {onStartConnectMember && (
            <Button
              size="sm"
              variant="primary"
              className="space3d-hud-action-btn space3d-hud-action-btn--primary"
              leadingIcon={<Spline size={14} />}
              onClick={() => onStartConnectMember(node.id)}
              title={t('space3d.hudConnectMemberTitle')}
            >
              {t('space3d.hudConnectMember')}
            </Button>
          )}
          {onAddLoadToNode && (
            <Button
              size="sm"
              className="space3d-hud-action-btn"
              leadingIcon={<Weight size={14} />}
              onClick={() => onAddLoadToNode(node.id)}
              title={t('space3d.hudAddLoadTitle')}
            >
              {t('space3d.hudAddLoad')}
            </Button>
          )}
          <Button
            size="sm"
            className="space3d-hud-action-btn"
            leadingIcon={<Edit3 size={14} />}
            onClick={onOpenEditor}
            title={t('space3d.saveNode')}
          >
            {t('space3d.hudEdit')}
          </Button>
          <IconButton
            size="sm"
            variant="danger"
            className="space3d-hud-action-btn space3d-hud-action-btn--danger"
            onClick={onDelete}
            label={t('space3d.deleteEntity')}
          >
            <Trash2 size={14} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    );
  }

  if (selection.kind === 'member') {
    const member = project.members.find((item) => item.id === selection.id);
    if (!member) return null;

    const startNode = project.nodes.find((item) => item.id === member.i);
    const endNode = project.nodes.find((item) => item.id === member.j);
    const length = startNode && endNode
      ? Math.hypot(endNode.x - startNode.x, endNode.y - startNode.y, endNode.z - startNode.z)
      : 0;

    const memberResult = analysis?.memberResults.find((item) => item.memberId === member.id);
    const axialAction = memberResult ? deriveSpace3DMemberAxialAction(memberResult) : null;
    const shearMagnitude = memberResult ? deriveSpace3DMemberShearMagnitude(memberResult) : null;
    const momentMagnitude = memberResult ? deriveSpace3DMemberMomentMagnitude(memberResult) : null;

    return (
      <div className="space3d-hud-card" role="region" aria-label={`${t('space3d.member')} ${member.id}`}>
        <div className="space3d-hud-header">
          <div className="space3d-hud-title-group">
            <span className="space3d-hud-badge space3d-hud-badge--member" aria-hidden="true"><MemberGlyph size={16} /></span>
            <strong className="space3d-hud-id">{member.id}</strong>
            <span className="space3d-hud-chip">{member.i} <ArrowRight size={10} aria-hidden="true" /> {member.j}</span>
          </div>
          <IconButton
            size="sm"
            className="space3d-hud-close"
            label={t('space3d.cancelEdit')}
            onClick={onDeselect}
          >
            <X size={15} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="space3d-hud-coordinates">
          <span>L: <b>{num(length)}</b> m</span>
          <span>A: <b>{num(member.A * 10000)}</b> cm²</span>
        </div>

        {memberResult && (
          <div className="space3d-hud-results space3d-hud-results--member">
            <div className="space3d-hud-result-item">
              <span>{t('space3d.hudAxial')}:</span>
              <strong className={(axialAction ?? 0) >= 0 ? 'space3d-val-tension' : 'space3d-val-compression'}>
                {num(axialAction ?? 0)} kN
              </strong>
            </div>
            <div className="space3d-hud-result-item">
              <span>{t('space3d.hudMomentMagnitude')}:</span>
              <strong>{num(momentMagnitude ?? 0)} kN·m</strong>
            </div>
            <div className="space3d-hud-result-item">
              <span>{t('space3d.hudShearMagnitude')}:</span>
              <strong>{num(shearMagnitude ?? 0)} kN</strong>
            </div>
          </div>
        )}

        <div className="space3d-hud-actions">
          <Button
            size="sm"
            variant="primary"
            className="space3d-hud-action-btn space3d-hud-action-btn--primary"
            leadingIcon={<Edit3 size={14} />}
            onClick={onOpenEditor}
          >
            {t('space3d.hudEditSection')}
          </Button>
          <IconButton
            size="sm"
            variant="danger"
            className="space3d-hud-action-btn space3d-hud-action-btn--danger"
            onClick={onDelete}
            label={t('space3d.deleteEntity')}
          >
            <Trash2 size={14} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
    );
  }

  // Carga seleccionada
  const load = project.nodalLoads.find((item) => item.id === selection.id);
  if (!load) return null;

  return (
    <div className="space3d-hud-card" role="region" aria-label={`${t('space3d.load')} ${load.id}`}>
      <div className="space3d-hud-header">
        <div className="space3d-hud-title-group">
          <span className="space3d-hud-badge space3d-hud-badge--load" aria-hidden="true"><PointLoadGlyph size={16} /></span>
          <strong className="space3d-hud-id">{load.id}</strong>
          <span className="space3d-hud-chip">{load.nodeId}</span>
        </div>
        <IconButton
          size="sm"
          className="space3d-hud-close"
          label={t('space3d.cancelEdit')}
          onClick={onDeselect}
        >
          <X size={15} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="space3d-hud-coordinates">
        <span>Fx: <b>{num(load.fx)}</b></span>
        <span>Fy: <b>{num(load.fy)}</b></span>
        <span>Fz: <b>{num(load.fz)}</b> kN</span>
      </div>
      {/* Una carga de momento puro tiene las tres fuerzas a cero: sin esta fila el
          resumen la presentaba como si no tuviera acción alguna. */}
      <div className="space3d-hud-coordinates">
        <span>Mx: <b>{num(load.mx)}</b></span>
        <span>My: <b>{num(load.my)}</b></span>
        <span>Mz: <b>{num(load.mz)}</b> kN·m</span>
      </div>

      <div className="space3d-hud-actions">
        <Button
          size="sm"
          variant="primary"
          className="space3d-hud-action-btn space3d-hud-action-btn--primary"
          leadingIcon={<Edit3 size={14} />}
          onClick={onOpenEditor}
        >
          {t('space3d.hudEditLoad')}
        </Button>
        <IconButton
          size="sm"
          variant="danger"
          className="space3d-hud-action-btn space3d-hud-action-btn--danger"
          onClick={onDelete}
          label={t('space3d.deleteEntity')}
        >
          <Trash2 size={14} aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
};
