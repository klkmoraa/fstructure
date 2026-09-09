/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');
const visualPath = `${SRC}/design-system/fstructure.css`;

describe('composición visual de FStructure', () => {
  it('carga la capa de producto después de la aplicación', () => {
    const main = readFileSync(`${SRC}/main.tsx`, 'utf8');
    expect(main).toContain("import './design-system/fstructure.css';");
  });

  it('publica la retícula del workbench y su adaptación responsive', () => {
    expect(existsSync(visualPath)).toBe(true);
    if (!existsSync(visualPath)) return;
    const css = readFileSync(visualPath, 'utf8');
    expect(css).toContain('--fstructure-rail-width: 88px');
    expect(css).toContain('--fstructure-header-height: 64px');
    expect(css).toContain(".app-shell[data-shell-class='X2']");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) var(--inspector-w)");
    expect(css).toContain('box-shadow: var(--sc-shadow-inset)');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('stroke: var(--sc-color-canvas-grid-strong);');
    expect(css).toContain(".app-shell.workspace-screen[data-shell-class='K0'] .center-stage");
    expect(css).toContain('@media (max-width: 760px)');
  });

  it('usa iconografía óptica y movimiento diferido sin cargar otro runtime', () => {
    const css = readFileSync(visualPath, 'utf8');
    const app = readFileSync(`${SRC}/App.tsx`, 'utf8');
    expect(css).toContain('stroke-width: 2');
    expect(app).toContain('<LazyMotion features={loadMotionFeatures} strict>');
    expect(app).toContain('<MotionConfig reducedMotion="user">');
  });

  it('hunde las herramientas sin encoger ni desplazar su caja', () => {
    const css = readFileSync(visualPath, 'utf8');
    expect(css).toContain(".mobile-tool-dock .tool-button:active:not(:disabled)");
    expect(css).toContain('box-shadow: var(--sc-shadow-pressed);');
    expect(css).toContain('transform: none;');
  });
});
