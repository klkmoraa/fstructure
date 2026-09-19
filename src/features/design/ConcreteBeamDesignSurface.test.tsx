// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDefaultProject, createHibbelerStyleDiagramPractice } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider, useProject } from '../../store/ProjectContext';
import { ConcreteBeamDesignSurface } from './ConcreteBeamDesignSurface';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

describe('ConcreteBeamDesignSurface', () => {
  it('muestra un estado vacío accionable sin inventar una viga o resultado', () => {
    render(<ProjectProvider><ConcreteBeamDesignSurface open presentation="dock" status="active" onOpenChange={() => undefined} /></ProjectProvider>);
    expect(screen.getByTestId('concrete-beam-design-surface').getAttribute('data-presentation')).toBe('dock');
    expect(screen.getByText('Selecciona una viga de marco para iniciar un diseño.')).toBeTruthy();
    expect(screen.queryByText('Calcular diseño')).toBeNull();
  });

  it('crea una asignación reversible para el miembro seleccionado y nunca inventa un resultado', async () => {
    const user = userEvent.setup();
    const project = createDefaultProject();
    project.combinations = [
      { id: 'SLS', name: 'Servicio NTC', factors: { LC1: 1 }, stateLimit: 'service', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
      { id: 'ULS', name: 'Última NTC', factors: { LC1: 1.4 }, stateLimit: 'ultimate', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
    ];
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const SelectMember = () => {
      const { setSelection } = useProject();
      useEffect(() => setSelection({ kind: 'member', id: 'M2' }), [setSelection]);
      return <ConcreteBeamDesignSurface open presentation="dock" status="active" onOpenChange={() => undefined} />;
    };
    render(<ProjectProvider><SelectMember /></ProjectProvider>);
    await user.click(await screen.findByRole('button', { name: 'Crear asignación' }));
    expect(screen.getByRole('button', { name: 'Calcular diseño' })).toBeTruthy();
    const cover = screen.getByRole('spinbutton', { name: /Recubrimiento/ });
    await user.clear(cover);
    await user.type(cover, '50');
    await user.tab();
    expect((cover as HTMLInputElement).value).toBe('50');
    expect(screen.getByText('Aún no hay un resultado de diseño.')).toBeTruthy();
  });

  it('recorre un resultado calculado sin sustituir sus demandas ni sus detalles por datos simulados', async () => {
    const user = userEvent.setup();
    const project = createHibbelerStyleDiagramPractice();
    project.members = project.members.map((member) => member.id === 'AB' ? {
      ...member,
      materialId: 'concrete-28mpa', materialOrigin: 'catalog', sectionId: 'rect-concrete-300x500', sectionOrigin: 'catalog',
      E: 24_870_062.324, A: 0.15, I: 0.003125,
    } : member);
    project.combinations = [
      { id: 'SLS', name: 'Servicio NTC', factors: { LC1: 1 }, stateLimit: 'service', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
      { id: 'ULS', name: 'Última NTC', factors: { LC1: 1.4 }, stateLimit: 'ultimate', jurisdiction: 'Ciudad de México', edition: '2023', sourceUrl: 'https://example.test/ntc' },
    ];
    project.designAssignments = [{
      id: 'DESIGN-AB', memberId: 'AB', kind: 'reinforced-concrete-beam', standardId: 'ntc-cdmx-2023-concrete',
      ultimateCombinationId: 'ULS', serviceCombinationId: 'SLS', coverMm: 40, longitudinalSteelYieldMpa: 420, stirrupSteelYieldMpa: 420,
      preferredLongitudinalDiametersMm: [12, 16, 20, 25, 32], preferredStirrupDiametersMm: [8, 10, 12], stirrupLegs: 2,
    }];
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
    const SelectBeam = () => {
      const { setSelection } = useProject();
      useEffect(() => setSelection({ kind: 'member', id: 'AB' }), [setSelection]);
      return <ConcreteBeamDesignSurface open presentation="dock" status="active" onOpenChange={() => undefined} />;
    };
    render(<ProjectProvider><SelectBeam /></ProjectProvider>);
    await user.click(await screen.findByRole('button', { name: 'Calcular diseño' }));
    expect(await screen.findByText('Demandas')).toBeTruthy();
    expect(screen.getByText('Refuerzo')).toBeTruthy();
    expect(screen.getByText('Detalle y evidencia')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sección transversal' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Elevación longitudinal' })).toBeTruthy();
    expect(screen.getByText('Cortante absoluto').parentElement?.querySelector('dd')?.textContent).not.toBe('— kN');
    expect(screen.getByText('Esquema informativo; no es un plano de fabricación.')).toBeTruthy();
  });
});
