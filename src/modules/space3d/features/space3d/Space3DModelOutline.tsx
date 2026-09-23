/**
 * Esquema del modelo espacial.
 *
 * Una sola lista por tipo de entidad, con lo que cada fila significa escrito en
 * palabras (posición, extremos, dónde actúa la carga). Elegir una fila la
 * selecciona en el lienzo y abre su formulario; nada se edita desde aquí.
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import type { Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DSelection } from '../../space3d/store/Space3DProjectContext';
import type { TranslationKey } from '../../i18n/catalogs';
import { formatSpace3DNumber } from './space3dNumberFormat';
import { SPACE3D_SUPPORT_LABEL_KEYS, space3DSupportKind } from './space3dSupportKind';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;
type Group = 'node' | 'member' | 'support' | 'load';

/** Una lista más larga que esto empieza plegada: el resto del panel sigue a la vista. */
const EXPANDED_LIMIT = 12;

const num = (value: number) => formatSpace3DNumber(value, { significantDigits: 4 });

export interface Space3DModelOutlineProps {
  readonly project: Space3DProjectV1;
  readonly selection: Space3DSelection | null;
  readonly t: Translate;
  readonly onSelect: (selection: Space3DSelection) => void;
  readonly onAddNode: () => void;
  readonly onAddMember: () => void;
  readonly onAddLoad: () => void;
  readonly canAddMember: boolean;
  readonly canAddLoad: boolean;
}

interface OutlineGroupProps {
  readonly id: Group;
  readonly title: string;
  readonly count: number;
  readonly t: Translate;
  readonly add?: { readonly label: string; readonly onClick: () => void; readonly disabled?: boolean; readonly hint?: string };
  readonly empty: string;
  readonly children: ReactNode;
}

const OutlineGroup = ({ id, title, count, t, add, empty, children }: OutlineGroupProps) => {
  const [open, setOpen] = useState(count <= EXPANDED_LIMIT);
  const listId = `space3d-outline-${id}`;
  return <section className="space3d-outline-group" data-group={id}>
    <header className="space3d-outline-head">
      <button
        type="button"
        className="space3d-outline-toggle"
        aria-expanded={open}
        aria-controls={listId}
        title={t(open ? 'space3d.outlineCollapse' : 'space3d.outlineExpand', { group: title })}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronRight size={15} aria-hidden="true" className="space3d-outline-chevron" />
        {title}
        <span className="space3d-outline-count">{count}</span>
      </button>
      {add ? <button
        type="button"
        className="space3d-outline-add"
        aria-label={add.label}
        title={add.disabled ? add.hint : add.label}
        disabled={add.disabled}
        onClick={add.onClick}
      ><Plus size={16} aria-hidden="true" /></button> : <span className="space3d-outline-add" aria-hidden="true" />}
    </header>
    <div id={listId} hidden={!open}>
      {count === 0 ? <p className="space3d-outline-empty">{empty}</p> : children}
    </div>
  </section>;
};

export const Space3DModelOutline = ({
  project, selection, t, onSelect, onAddNode, onAddMember, onAddLoad, canAddMember, canAddLoad,
}: Space3DModelOutlineProps) => {
  const isSelected = (kind: Space3DSelection['kind'], id: string) => selection?.kind === kind && selection.id === id;
  const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
  const supported = project.nodes.filter((node) => space3DSupportKind(node.restraints) !== 'free');

  const row = (kind: Space3DSelection['kind'], id: string, description: string, tag?: string) => <li key={id}>
    <button
      type="button"
      className="space3d-outline-row"
      aria-current={isSelected(kind, id) || undefined}
      onClick={() => onSelect({ kind, id })}
    >
      <span className="space3d-outline-id">{id}</span>
      <span className="space3d-outline-desc">{description}</span>
      {tag ? <span className="space3d-outline-tag">{tag}</span> : null}
    </button>
  </li>;

  return <div className="space3d-outline">
    <OutlineGroup id="node" title={t('space3d.nodes')} count={project.nodes.length} t={t} empty={t('space3d.emptyNodes')}
      add={{ label: t('space3d.addNodeAction'), onClick: onAddNode }}>
      <ul className="space3d-outline-list" aria-label={t('space3d.nodes')}>
        {project.nodes.map((node) => {
          const kind = space3DSupportKind(node.restraints);
          return row('node', node.id, `(${num(node.x)}, ${num(node.y)}, ${num(node.z)}) ${t('space3d.unitLength')}`,
            kind === 'free' ? undefined : t(SPACE3D_SUPPORT_LABEL_KEYS[kind]));
        })}
      </ul>
    </OutlineGroup>

    <OutlineGroup id="member" title={t('space3d.members')} count={project.members.length} t={t} empty={t('space3d.emptyMembers')}
      add={{ label: t('space3d.addMemberAction'), onClick: onAddMember, disabled: !canAddMember, hint: t('space3d.newMemberHint') }}>
      <ul className="space3d-outline-list" aria-label={t('space3d.members')}>
        {project.members.map((member) => {
          const start = nodeById.get(member.i);
          const end = nodeById.get(member.j);
          const length = start && end ? Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z) : null;
          const span = `${member.i} → ${member.j}`;
          return row('member', member.id, length === null ? span : `${span}, ${num(length)} ${t('space3d.unitLength')}`,
            member.sectionOrigin === 'catalog' ? member.sectionId : undefined);
        })}
      </ul>
    </OutlineGroup>

    <OutlineGroup id="support" title={t('space3d.supports')} count={supported.length} t={t} empty={t('space3d.outlineNoSupports')}>
      <ul className="space3d-outline-list" aria-label={t('space3d.supports')}>
        {supported.map((node) => row('node', node.id, t(SPACE3D_SUPPORT_LABEL_KEYS[space3DSupportKind(node.restraints)])))}
      </ul>
      <p className="space3d-outline-hint">{t('space3d.outlineSupportsHint')}</p>
    </OutlineGroup>

    <OutlineGroup id="load" title={t('space3d.loads')} count={project.nodalLoads.length} t={t} empty={t('space3d.emptyLoads')}
      add={{ label: t('space3d.addLoadAction'), onClick: onAddLoad, disabled: !canAddLoad, hint: t('space3d.newLoadHint') }}>
      <ul className="space3d-outline-list" aria-label={t('space3d.loads')}>
        {project.nodalLoads.map((load) => {
          const force = Math.hypot(load.fx, load.fy, load.fz);
          const moment = Math.hypot(load.mx, load.my, load.mz);
          const magnitude = force > 0 || moment === 0
            ? `${num(force)} ${t('space3d.unitForce')}`
            : `${num(moment)} ${t('space3d.unitMoment')}`;
          return row('load', load.id, `${t('space3d.loadOnNode', { node: load.nodeId })}, ${magnitude}`);
        })}
      </ul>
    </OutlineGroup>

    <p className="space3d-outline-footnote">
      {t('space3d.outlineCases', { cases: project.loadCases.length, combos: project.loadCombinations.length })}
    </p>
  </div>;
};
