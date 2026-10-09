// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { designSectionStudio } from '../../../design/concrete/sectionStudio';
import { ConcreteStudio } from './ConcreteStudio';
import { ConcreteSectionDrawing, SectionEquilibriumDrawing, SectionInteractionDrawing, SectionLongitudinalDrawing } from './ConcreteStudioDrawings';
import { SECTION_DEFAULTS, SECTION_SHAPES, sectionDraftErrors, sectionInput, sectionPreset, sectionReportFromDraft } from './concreteStudioModel';
import type { WorkbenchChrome } from './WorkbenchLayout';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
const chrome: WorkbenchChrome = { elements: null, codeControl: null, code: 'ntc-2023', panels: { inputs: true, results: true }, setPanel: vi.fn(), onReport: vi.fn() };

describe('ConcreteStudio modelo y diagramas', () => {
  it('adapta grupos de zonas y valida conteos antes de calcular o reportar', () => {
    expect(SECTION_DEFAULTS.cornerBarCount).toBe('1');
    expect(SECTION_DEFAULTS.faceBarCount).toBe('1');
    const draft = { ...SECTION_DEFAULTS, preset: 'custom', shape: 'rectangle', width: '60', height: '60', barLayout: 'zones', cornerBarCount: '3', faceBarCount: '3' };
    const input = sectionInput(draft);
    expect(input.barLayout).toBe('zones');
    expect(input.barCount).toBe(24);
    expect(input.cornerBarCount).toBe(3);
    expect(input.faceBarCount).toBe(3);
    expect(sectionDraftErrors(draft)).toEqual([]);
    expect(sectionDraftErrors({ ...draft, cornerBarCount: '1.5' }).length).toBeGreaterThan(0);
    expect(sectionDraftErrors({ ...draft, faceBarCount: '4' }).length).toBeGreaterThan(0);
    expect(sectionDraftErrors({ ...draft, shape: 'circle' }).length).toBeGreaterThan(0);
    const custom = sectionPreset('custom', { ...SECTION_DEFAULTS, width: '71', axial: '123', barLayout: 'zones', cornerBarCount: '2', faceBarCount: '1' });
    expect(custom.width).toBe('71');
    expect(custom.axial).toBe('123');
    expect(custom.cornerBarCount).toBe('2');
    expect(custom.faceBarCount).toBe('1');
  });

  it('reporta la distribución experimental de zonas y el criterio de separación geométrica', () => {
    const report = sectionReportFromDraft('ntc-2023', { ...SECTION_DEFAULTS, preset: 'custom', shape: 'square', width: '60', height: '60', barLayout: 'zones', cornerBarCount: '3', faceBarCount: '3' });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.report.memo).toContain('3 por esquina');
    expect(report.report.memo).toContain('3 por cara');
    expect(report.report.memo).toContain('criterio geométrico experimental');
    expect(report.report.reinforcement[0].value).toContain('zonas');
    expect(report.report.figures.some(({ title }) => title.includes('Sección'))).toBe(true);
  });

  it('convierte unidades y no modifica demanda al cambiar de filosofía sin factor explícito', () => {
    const direct = sectionInput({ ...SECTION_DEFAULTS, axial: '100', moment: '-20', philosophy: 'ultimate' });
    const partial = sectionInput({ ...SECTION_DEFAULTS, axial: '100', moment: '-20', philosophy: 'limit-state' });
    expect(direct.widthMm).toBe(400);
    expect(direct.fcMpa).toBeCloseTo(24.516, 2);
    expect([direct.axialKn, direct.momentKnm]).toEqual([100, -20]);
    expect([partial.axialKn, partial.momentKnm]).toEqual([100, -20]);
    const service = sectionInput({ ...SECTION_DEFAULTS, axial: '100', moment: '-20', philosophy: 'ultimate', demandBasis: 'service', loadFactor: '1,5' });
    expect([service.axialKn, service.momentKnm]).toEqual([150, -30]);
    const allowable = sectionInput({ ...SECTION_DEFAULTS, axial: '100', philosophy: 'allowable', demandBasis: 'service', loadFactor: '1.5' });
    expect(allowable.axialKn).toBe(100);
  });

  it('rechaza factores que eliminan la carga y enums corruptos antes de generar la memoria', () => {
    for (const value of ['0', '-2', '', 'Infinity', 'abc']) {
      const draft = { ...SECTION_DEFAULTS, demandBasis: 'service', loadFactor: value };
      expect(sectionDraftErrors(draft).length).toBeGreaterThan(0);
      expect(sectionReportFromDraft('ntc-2023', draft).ok).toBe(false);
    }
    expect(sectionReportFromDraft('ntc-2023', { ...SECTION_DEFAULTS, shape: 'unknown' }).ok).toBe(false);
    expect(sectionReportFromDraft('ntc-2023', { ...SECTION_DEFAULTS, philosophy: 'unknown' }).ok).toBe(false);
  });

  it('los presets de viga y losa usan lechos reales y conservan la identidad', () => {
    const beam = sectionPreset('beam', { ...SECTION_DEFAULTS, tag: 'V-5' });
    expect(beam.tag).toBe('V-5');
    expect(sectionInput(beam).barLayout).toBe('layers');
    expect(sectionInput(beam).axialKn).toBe(0);
    const slab = sectionPreset('slab', SECTION_DEFAULTS);
    const result = designSectionStudio(sectionInput(slab));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.geometry.widthMm).toBe(1000);
    expect(result.geometry.bars).toHaveLength(6);
    expect(new Set(result.geometry.bars.map((bar) => bar.y)).size).toBe(1);
    expect(result.quantities.concreteM3).toBeCloseTo(.6, 6);
  });

  it('el momento perpendicular pendiente no se convierte en una comprobación aprobada', () => {
    const report = sectionReportFromDraft('ntc-2023', { ...SECTION_DEFAULTS, shape: 'rectangle', width: '40', height: '60', angle: '25', axial: '300', moment: '50' });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    const capacity = report.report.checks.find((check) => check.id === 'section-capacity');
    expect(capacity?.status).toBe('warning');
    expect(capacity?.label).toContain('equilibrio perpendicular pendiente');
    expect(report.report.memo).toContain('no verifica equilibrio uniaxial ni biaxial');
  });

  it('escala deformación con profundidad proyectada en un eje girado y alinea ambas etiquetas', () => {
    const result = designSectionStudio(sectionInput({ ...SECTION_DEFAULTS, shape: 'rectangle', width: '30', height: '55', angle: '90' }));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(Math.max(...result.analysis.strainProfile.map((p) => p.depthMm))).toBeCloseTo(300, 5);
    const svg = new DOMParser().parseFromString(renderToStaticMarkup(<SectionEquilibriumDrawing result={result} />), 'image/svg+xml');
    const path = svg.querySelector('.cs-strain-line')!.getAttribute('d')!;
    const yValues = [...path.matchAll(/[ML][^,]+,([-\d.]+)/g)].map((match) => Number(match[1]));
    expect(yValues[0]).toBeCloseTo(64, 6);
    expect(yValues.at(-1)).toBeCloseTo(284, 6);
    const labels = svg.querySelectorAll('text.cs-symbol[x="487"]');
    expect(Number(labels[0].getAttribute('y'))).toBeCloseTo(yValues[0] + 8, 6);
    expect(Number(labels[1].getAttribute('y'))).toBeCloseTo(yValues.at(-1)! - 2, 6);
  });

  it('resume un detalle denso conservando ambos extremos y el conteo calculado', () => {
    const result = designSectionStudio(sectionInput({ ...SECTION_DEFAULTS, length: '30', tieSpacing: '1' }));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.quantities.tieCount).toBe(3001);
    const svg = new DOMParser().parseFromString(renderToStaticMarkup(<SectionLongitudinalDrawing result={result} />), 'image/svg+xml');
    const stations = svg.querySelectorAll('line.dw-stirrup');
    expect(stations.length).toBe(2000);
    expect(stations[0].getAttribute('x1')).toBe('49');
    expect(stations[stations.length - 1].getAttribute('x1')).toBe('500');
    expect(svg.documentElement.textContent).toContain('Vista resumida');
    expect(svg.documentElement.textContent).toContain('3001 juegos');
  });

  it.each(SECTION_SHAPES.map((shape) => shape.value))('genera dibujos finitos y cuantificación trazable para %s', (shape) => {
    const result = designSectionStudio(sectionInput({ ...SECTION_DEFAULTS, shape, width: '60', height: '60', moment: '-40' }));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const diagrams = [<ConcreteSectionDrawing result={result} />, <SectionInteractionDrawing result={result} />, <SectionEquilibriumDrawing result={result} />, <SectionLongitudinalDrawing result={result} />];
    for (const diagram of diagrams) {
      const html = renderToStaticMarkup(diagram);
      expect(html).toContain('role="img"');
      expect(html).not.toMatch(/NaN|Infinity/);
    }
    const report = sectionReportFromDraft('ntc-2023', { ...SECTION_DEFAULTS, shape, width: '60', height: '60', moment: '-40' });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.report.element).toBe('section');
    expect(report.report.basisLabel).toContain('modelo experimental');
    expect(report.report.takeoff.steelKg).toBeCloseTo(result.quantities.totalSteelKg, 6);
    expect(report.report.figures).toHaveLength(4);
    expect(report.report.outOfScope.length).toBeGreaterThan(0);
  });

  it('exige una base válida antes de aplicar un factor desde la interfaz', async () => {
    const user = userEvent.setup();
    render(<ConcreteStudio chrome={chrome} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Base de las solicitaciones' }), 'service');
    const factor = screen.getByRole('textbox', { name: 'Factor global de demanda' });
    await user.clear(factor);
    await user.type(factor, '0');
    expect(screen.getByText(/factor global de demanda debe ser.*mayor o igual que 1/)).toBeTruthy();
    await user.clear(factor);
    await user.type(factor, '1.5');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Resultados' })).getByText('1,350.0 kN')).toBeTruthy();
  });

  it('muestra zuncho para círculo y grapas reales en polígono sin certificar el elemento', async () => {
    const user = userEvent.setup();
    render(<ConcreteStudio chrome={chrome} />);
    const shape = screen.getByRole('combobox', { name: 'Forma de la sección' });
    await user.selectOptions(shape, 'circle');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Refuerzo transversal' }), 'spiral');
    await user.click(screen.getByRole('button', { name: 'Estribos' }));
    expect(screen.getByRole('img', { name: /Distribución longitudinal.*zuncho/ })).toBeTruthy();
    await user.selectOptions(shape, 'octagon');
    const transverse = screen.getByRole('combobox', { name: 'Refuerzo transversal' });
    expect((transverse as HTMLSelectElement).value).toBe('closed');
    await user.selectOptions(transverse, 'cross-tie');
    expect(screen.getByRole('img', { name: /Distribución longitudinal/ })).toBeTruthy();
    expect(screen.queryByText('Cumple')).toBeNull();
  });

  it('al elegir polígonos propone conteos simétricos y conserva un múltiplo ya definido', async () => {
    const user = userEvent.setup();
    render(<ConcreteStudio chrome={chrome} />);
    const shape = screen.getByRole('combobox', { name: 'Forma de la sección' });
    await user.selectOptions(shape, 'triangle');
    const bars = screen.getByRole('textbox', { name: 'Número de barras' }) as HTMLInputElement;
    expect(bars.value).toBe('6');
    await user.clear(bars);
    await user.type(bars, '12');
    await user.selectOptions(shape, 'hexagon');
    expect(bars.value).toBe('12');
    await user.selectOptions(shape, 'octagon');
    expect(bars.value).toBe('8');
  });
});
