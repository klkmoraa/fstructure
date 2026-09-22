/**
 * Floating On-Canvas Selection HUD for Space 3D.
 *
 * Provides immediate contextual readouts and rapid actions right on the 3D canvas
 * (both desktop and mobile) when an entity is selected.
 */
import { ArrowRight, Edit3, Spline, Trash2, Weight, X } from 'lucide-react';
import type { Space3DAnalysisResult, Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DSelection } from '../../space3d/store/Space3DProjectContext';
import { formatSpace3DNumber } from './space3dNumberFormat';
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
    const supportLabel = restraintCount === 6
      ? (t('space3d.supportFixed' as TranslationKey) || 'Empotrado')
      : restraintCount >= 3
        ? (t('space3d.supportPinned' as TranslationKey) || 'Articulado')
        : restraintCount > 0
          ? `${restraintCount} GDL`
          : (t('space3d.supportFree' as TranslationKey) || 'Libre');

    // Nodal displacement if analysis is available
    const nodeResult = analysis?.nodeResults.find((item) => item.nodeId === node.id);

    return (
      <div className="space3d-hud-card" role="region" aria-label={`Nudo ${node.id}`}>
        <div className="space3d-hud-header">
          <div className="space3d-hud-title-group">
            <span className="space3d-hud-badge space3d-hud-badge--node">N</span>
            <strong className="space3d-hud-id">{node.id}</strong>
            <span className="space3d-hud-chip">{supportLabel}</span>
          </div>
          <button
            type="button"
            className="space3d-hud-close"
            onClick={onDeselect}
            aria-label={t('space3d.cancelEdit')}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="space3d-hud-coordinates">
          <span>X: <b>{num(node.x)}</b> m</span>
          <span>Y: <b>{num(node.y)}</b> m</span>
          <span>Z: <b>{num(node.z)}</b> m</span>
        </div>

        {nodeResult && (
          <div className="space3d-hud-results">
            <div className="space3d-hud-result-item">
              <span>uy (flecha):</span>
              <strong>{num(nodeResult.displacement.uy * 1000)} mm</strong>
            </div>
            {restraintCount > 0 && (
              <div className="space3d-hud-result-item">
                <span>Ry (reacción):</span>
                <strong>{num(nodeResult.reaction.uy)} kN</strong>
              </div>
            )}
          </div>
        )}

        <div className="space3d-hud-actions">
          {onStartConnectMember && (
            <button
              type="button"
              className="space3d-hud-action-btn space3d-hud-action-btn--primary"
              onClick={() => onStartConnectMember(node.id)}
              title="Conectar con otro nudo para crear barra"
            >
              <Spline size={14} aria-hidden="true" />
              <span>Conectar barra</span>
            </button>
          )}
          {onAddLoadToNode && (
            <button
              type="button"
              className="space3d-hud-action-btn"
              onClick={() => onAddLoadToNode(node.id)}
              title="Añadir carga en este nudo"
            >
              <Weight size={14} aria-hidden="true" />
              <span>Carga</span>
            </button>
          )}
          <button
            type="button"
            className="space3d-hud-action-btn"
            onClick={onOpenEditor}
            title={t('space3d.saveNode')}
          >
            <Edit3 size={14} aria-hidden="true" />
            <span>Editar</span>
          </button>
          <button
            type="button"
            className="space3d-hud-action-btn space3d-hud-action-btn--danger"
            onClick={onDelete}
            title={t('space3d.deleteEntity')}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
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

    return (
      <div className="space3d-hud-card" role="region" aria-label={`Barra ${member.id}`}>
        <div className="space3d-hud-header">
          <div className="space3d-hud-title-group">
            <span className="space3d-hud-badge space3d-hud-badge--member">M</span>
            <strong className="space3d-hud-id">{member.id}</strong>
            <span className="space3d-hud-chip">{member.i} <ArrowRight size={10} aria-hidden="true" /> {member.j}</span>
          </div>
          <button
            type="button"
            className="space3d-hud-close"
            onClick={onDeselect}
            aria-label={t('space3d.cancelEdit')}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="space3d-hud-coordinates">
          <span>L: <b>{num(length)}</b> m</span>
          <span>A: <b>{num(member.A * 10000)}</b> cm²</span>
        </div>

        {memberResult && (
          <div className="space3d-hud-results space3d-hud-results--member">
            <div className="space3d-hud-result-item">
              <span>Axial N:</span>
              <strong className={memberResult.start.N >= 0 ? 'space3d-val-tension' : 'space3d-val-compression'}>
                {num(memberResult.start.N)} kN
              </strong>
            </div>
            <div className="space3d-hud-result-item">
              <span>Momento Mz:</span>
              <strong>{num(Math.max(Math.abs(memberResult.start.Mz), Math.abs(memberResult.end.Mz)))} kN·m</strong>
            </div>
            <div className="space3d-hud-result-item">
              <span>Cortante Vy:</span>
              <strong>{num(memberResult.start.Vy)} kN</strong>
            </div>
          </div>
        )}

        <div className="space3d-hud-actions">
          <button
            type="button"
            className="space3d-hud-action-btn space3d-hud-action-btn--primary"
            onClick={onOpenEditor}
          >
            <Edit3 size={14} aria-hidden="true" />
            <span>Editar sección</span>
          </button>
          <button
            type="button"
            className="space3d-hud-action-btn space3d-hud-action-btn--danger"
            onClick={onDelete}
            title={t('space3d.deleteEntity')}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // Carga seleccionada
  const load = project.nodalLoads.find((item) => item.id === selection.id);
  if (!load) return null;

  return (
    <div className="space3d-hud-card" role="region" aria-label={`Carga ${load.id}`}>
      <div className="space3d-hud-header">
        <div className="space3d-hud-title-group">
          <span className="space3d-hud-badge space3d-hud-badge--load">L</span>
          <strong className="space3d-hud-id">{load.id}</strong>
          <span className="space3d-hud-chip">{load.nodeId}</span>
        </div>
        <button
          type="button"
          className="space3d-hud-close"
          onClick={onDeselect}
          aria-label={t('space3d.cancelEdit')}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="space3d-hud-coordinates">
        <span>Fx: <b>{num(load.fx)}</b></span>
        <span>Fy: <b>{num(load.fy)}</b></span>
        <span>Fz: <b>{num(load.fz)}</b> kN</span>
      </div>

      <div className="space3d-hud-actions">
        <button
          type="button"
          className="space3d-hud-action-btn space3d-hud-action-btn--primary"
          onClick={onOpenEditor}
        >
          <Edit3 size={14} aria-hidden="true" />
          <span>Editar carga</span>
        </button>
        <button
          type="button"
          className="space3d-hud-action-btn space3d-hud-action-btn--danger"
          onClick={onDelete}
          title={t('space3d.deleteEntity')}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
