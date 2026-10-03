// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { evaluateDiagramAt } from '../../engine/diagram';
import { analyzeProject } from '../../engine/solver';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { ResultsPanel } from './ResultsPanel';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

/** Analiza al montar y elige la viga M2 del pórtico de ejemplo. */
function Analyzed() {
  const { analyze, setSelection } = useProject();
  useEffect(() => { analyze(); setSelection({ kind: 'member', id: 'M2' }); }, [analyze, setSelection]);
  return <ResultsPanel status="active" defaultDesktopExpanded />;
}

describe('lámina del miembro en Resultados del 2D', () => {
  it('apila N, V, M y Δ y lee los mismos valores que el diagrama exacto', async () => {
    const user = userEvent.setup();
    render(<ProjectProvider><div className="app-shell"><Analyzed /></div></ProjectProvider>);
    await user.click(await screen.findByRole('tab', { name: 'Lámina' }, { timeout: 5000 }));
    const sheet = await screen.findByTestId('member-sheet');
    const drawing = within(sheet).getByRole('img', { name: /Lámina del miembro M2: N, V, M, Δ/ });
    // Fin de la viga: el momento del extremo j.
    fireEvent.keyDown(drawing, { key: 'End' });
    const project = createDefaultProject();
    const engine = analyzeProject(project, { id: 'c', name: 'c', factors: { LC1: 1 } }, { includeEducationTrace: false });
    const beam = engine.memberResults.find((member) => member.memberId === 'M2')!;
    const end = evaluateDiagramAt(beam.diagramSegments, beam.diagramJumps, beam.length, 'left')!;
    const readout = within(sheet).getByText('M', { selector: 'b' }).parentElement!.textContent!;
    const shown = Number(readout.replace(/[^\d.,-]/g, '').replace(',', ''));
    expect(shown).toBeCloseTo(end.moment, 1);
    // Otra pestaña de magnitud cierra la lámina.
    await user.click(screen.getByRole('tab', { name: 'Resumen' }));
    expect(screen.queryByTestId('member-sheet')).toBeNull();
  });
});
