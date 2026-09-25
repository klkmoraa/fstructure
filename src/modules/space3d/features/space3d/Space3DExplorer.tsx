/**
 * Explorador del modelo, al modo del «Model Explorer» de ETABS: pisos y ejes
 * que abren su planta o alzado, secciones en uso que seleccionan sus barras y
 * casos/combinaciones que fijan qué se analiza.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import type { TranslationKey } from '../../i18n/catalogs';
import type { Space3DProjectV1 } from '../../space3d/model/types';
import type { Space3DResolvedGrid } from '../../space3d/model/grid';
import { space3DSectionKey } from './space3dAssign';
import { formatSpace3DNumber } from './space3dNumberFormat';
import type { Space3DViewId } from './space3dViews';

type Translate = (key: TranslationKey, variables?: Record<string, string | number>) => string;

interface Space3DExplorerProps {
  readonly t: Translate;
  readonly project: Space3DProjectV1;
  readonly grid: Space3DResolvedGrid;
  readonly viewId: Space3DViewId;
  readonly onView: (id: Space3DViewId) => void;
  readonly analysisTargetId: string;
  readonly onTarget: (id: string) => void;
  readonly onSelectMembers: (ids: readonly string[]) => void;
  readonly onEditGrid: () => void;
  readonly onEditLoads: () => void;
}

const Section = ({ title, count, action, children, initiallyOpen = true }: {
  title: string; count: number; action?: ReactNode; children: ReactNode; initiallyOpen?: boolean;
}) => {
  const [open, setOpen] = useState(initiallyOpen);
  return <section className="space3d-explorer-section" data-open={open || undefined}>
    <header>
      <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <ChevronRight size={14} aria-hidden="true" />
        <span>{title}</span>
        <small>{count}</small>
      </button>
      {action}
    </header>
    {open ? children : null}
  </section>;
};

export const Space3DExplorer = ({
  t, project, grid, viewId, onView, analysisTargetId, onTarget, onSelectMembers, onEditGrid, onEditLoads,
}: Space3DExplorerProps) => {
  const sections = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const member of project.members) {
      const key = space3DSectionKey(member);
      const list = groups.get(key);
      if (list) list.push(member.id);
      else groups.set(key, [member.id]);
    }
    return [...groups].sort((a, b) => b[1].length - a[1].length);
  }, [project.members]);
  const number = (value: number) => formatSpace3DNumber(value, { significantDigits: 4 });
  const editButton = (label: string, onClick: () => void) => <button type="button" className="space3d-explorer-edit" title={label} aria-label={label} onClick={onClick}>
    <Pencil size={13} aria-hidden="true" />
  </button>;

  return <aside className="space3d-explorer" aria-label={t('space3d.explorer.title')}>
    <h2 className="space3d-explorer-title">{t('space3d.explorer.title')}</h2>
    {grid.automatic && grid.stories.length > 0 ? <p className="space3d-explorer-note">{t('space3d.explorer.automaticGrid')}</p> : null}

    <Section title={t('space3d.explorer.stories')} count={grid.stories.length} action={editButton(t('space3d.explorer.editGrid'), onEditGrid)}>
      <ul className="space3d-explorer-list">
        {[...grid.stories].reverse().map((story) => {
          const id = `plan:${story.id}`;
          return <li key={story.id}>
            <button type="button" aria-current={viewId === id || undefined} title={t('space3d.explorer.showPlan', { name: story.name })} onClick={() => onView(id)}>
              <span>{story.name}</span>
              <small>{t('space3d.explorer.elevation', { value: number(story.elevation) })}</small>
            </button>
          </li>;
        })}
      </ul>
    </Section>

    <Section title={t('space3d.explorer.gridX')} count={grid.xLines.length} initiallyOpen={grid.xLines.length <= 8}>
      <ul className="space3d-explorer-chips">
        {grid.xLines.map((line) => {
          const id = `elev-x:${line.id}`;
          return <li key={line.id}>
            <button type="button" aria-current={viewId === id || undefined} title={t('space3d.explorer.showElevation', { id: line.id })} onClick={() => onView(id)}>
              <b>{line.id}</b><small>{number(line.coordinate)}</small>
            </button>
          </li>;
        })}
      </ul>
    </Section>

    <Section title={t('space3d.explorer.gridZ')} count={grid.zLines.length} initiallyOpen={grid.zLines.length <= 8}>
      <ul className="space3d-explorer-chips">
        {grid.zLines.map((line) => {
          const id = `elev-z:${line.id}`;
          return <li key={line.id}>
            <button type="button" aria-current={viewId === id || undefined} title={t('space3d.explorer.showElevation', { id: line.id })} onClick={() => onView(id)}>
              <b>{line.id}</b><small>{number(line.coordinate)}</small>
            </button>
          </li>;
        })}
      </ul>
    </Section>

    <Section title={t('space3d.explorer.sections')} count={sections.length}>
      <ul className="space3d-explorer-list">
        {sections.map(([name, ids]) => <li key={name}>
          <button type="button" title={t('space3d.explorer.selectSection', { count: ids.length, name })} onClick={() => onSelectMembers(ids)}>
            <span>{name}</span>
            <small>{t('space3d.explorer.sectionCount', { count: ids.length })}</small>
          </button>
        </li>)}
      </ul>
    </Section>

    <Section title={t('space3d.explorer.cases')} count={project.loadCases.length} action={editButton(t('space3d.explorer.editLoads'), onEditLoads)}>
      <ul className="space3d-explorer-list">
        {project.loadCases.map((loadCase) => <li key={loadCase.id}>
          <button type="button" aria-current={analysisTargetId === loadCase.id || undefined} title={t('space3d.explorer.analyzeTarget', { name: loadCase.name })} onClick={() => onTarget(loadCase.id)}>
            <span>{loadCase.name}</span>
            <small>{loadCase.selfWeightFactor ? t('space3d.explorer.selfWeight', { factor: number(loadCase.selfWeightFactor) }) : loadCase.id}</small>
          </button>
        </li>)}
      </ul>
    </Section>

    <Section title={t('space3d.explorer.combinations')} count={project.loadCombinations.length} initiallyOpen={project.loadCombinations.length <= 10}>
      <ul className="space3d-explorer-list">
        {project.loadCombinations.map((combination) => <li key={combination.id}>
          <button type="button" aria-current={analysisTargetId === combination.id || undefined} title={t('space3d.explorer.analyzeTarget', { name: combination.name })} onClick={() => onTarget(combination.id)}>
            <span>{combination.name}</span>
            <small>{combination.id}</small>
          </button>
        </li>)}
      </ul>
    </Section>
  </aside>;
};
