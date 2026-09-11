// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectProvider } from '../../store/ProjectContext';
import { SupportPicker } from './SupportPicker';

afterEach(cleanup);

const renderPicker = (ui: React.ReactElement) => render(<ProjectProvider>{ui}</ProjectProvider>);

const baseProps = {
  support: { type: 'none' as const },
  selectionKey: 'node:N1',
  units: 'kN-m' as const,
  classroomMode: false,
  settlementCount: 0,
  onApplyPreset: vi.fn(),
  onAngleChange: vi.fn(),
  onVisualAngleChange: vi.fn(),
  onRestraintChange: vi.fn(),
  onSpringChange: vi.fn(),
};

describe('SupportPicker', () => {
  it('calls onApplyPreset when clicking an elastic support tile', () => {
    const onApplyPreset = vi.fn();
    renderPicker(<SupportPicker {...baseProps} onApplyPreset={onApplyPreset} />);

    // Switch to Elásticos tab
    const elasticTab = screen.getByRole('tab', { name: /Elásticos/i });
    fireEvent.click(elasticTab);

    // Click Resorte Y
    const springYTile = screen.getByRole('button', { name: /Resorte Y/i });
    expect(springYTile).toBeTruthy();
    fireEvent.click(springYTile);

    expect(onApplyPreset).toHaveBeenCalledTimes(1);
    expect(onApplyPreset.mock.calls[0][0].id).toBe('spring-y');
  });

  it('calls onApplyPreset when clicking an advanced support tile', () => {
    const onApplyPreset = vi.fn();
    renderPicker(<SupportPicker {...baseProps} onApplyPreset={onApplyPreset} />);

    // Switch to Avanzado tab
    const advancedTab = screen.getByRole('tab', { name: /Avanzado/i });
    fireEvent.click(advancedTab);

    // Click Sólo compresión
    const compressionTile = screen.getByRole('button', { name: /Sólo compresión/i });
    expect(compressionTile).toBeTruthy();
    expect(compressionTile.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(compressionTile);

    expect(onApplyPreset).toHaveBeenCalledTimes(1);
    expect(onApplyPreset.mock.calls[0][0].id).toBe('compression-only');
  });

  it('marks the active spring tile when the node has elastic stiffness', () => {
    renderPicker(<SupportPicker {...baseProps} support={{ type: 'none', spring: { ky: 1000 } }} />);

    // Resorte Y should be active
    const springYTile = screen.getByRole('button', { name: /Resorte Y/i });
    expect(springYTile.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the active contact tile when activeNodeLink is present', () => {
    const activeNodeLink = {
      id: 'LINK1',
      nodeI: 'N1',
      behavior: 'compression-only' as const,
      stiffness: 10000,
      angleDeg: 90,
    };
    renderPicker(<SupportPicker {...baseProps} activeNodeLink={activeNodeLink} />);

    const compressionTile = screen.getByRole('button', { name: /Sólo compresión/i });
    expect(compressionTile.getAttribute('aria-pressed')).toBe('true');
  });
});
