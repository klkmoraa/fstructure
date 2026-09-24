import type { ReactNode } from 'react';
import type { ToolId } from '../../shared/contracts';

/**
 * Glifos de herramienta del brandbook de FusionStructure (FS-A01…FS-A04).
 *
 * Copia fiel de `brandbook-site/app/brand/generated/glyphs.tsx`: retícula de
 * 48 u, trazo 2.6 y un único color de acento (`--glyph-accent`) que lleva la
 * familia Análisis. El glifo distingue la herramienta incluso sin color.
 */
const accent = 'var(--glyph-accent, currentColor)';

const GLYPHS: Record<ToolId, ReactNode> = {
  model2d: <>
    <path d="M9 14h30M9 14v22M39 14v22" stroke="currentColor" />
    <path d="M5 40h8l-4-4zM35 40h8l-4-4z" fill="currentColor" stroke="none" />
    <path d="M15 5v5M24 5v5M33 5v5" stroke={accent} />
    <path d="m13 10 2 3 2-3M22 10l2 3 2-3M31 10l2 3 2-3" fill={accent} stroke="none" />
    <path d="M11 21c8 0 6 9 13 9s5-9 13-9" stroke={accent} />
    <circle cx="9" cy="14" r="2.6" fill="currentColor" stroke="none" />
    <circle cx="39" cy="14" r="2.6" fill="currentColor" stroke="none" />
  </>,
  space3d: <>
    <path d="M24 8 40 16v16l-16 8-16-8V16z" stroke="currentColor" />
    <path d="M24 8v16m0 0 16-8m-16 8-16-8m16 8v16" stroke="currentColor" opacity=".55" />
    <circle cx="24" cy="24" r="3.4" fill={accent} stroke="none" />
    <path d="M24 24 36 18M24 24l-9 9M24 24v-9" stroke={accent} />
  </>,
  fem: <>
    <path d="M8 10h32v28H8z" stroke="currentColor" />
    <path d="M18 10v28M29 10v28M8 20h32M8 29h32" stroke="currentColor" opacity=".5" />
    <path d="M18 20h11v9H18z" fill={accent} stroke="none" opacity=".9" />
    <circle cx="18" cy="20" r="2.2" fill="currentColor" stroke="none" />
    <circle cx="29" cy="29" r="2.2" fill="currentColor" stroke="none" />
  </>,
  design: <>
    <path d="M7 9h13M13.5 9v17M7 26h13" stroke="currentColor" />
    <path d="M7 33h13M7 40h13" stroke="currentColor" opacity=".45" />
    <path d="M27 42V22" stroke="currentColor" strokeWidth="7" strokeLinecap="butt" />
    <path d="M38 42V14" stroke={accent} strokeWidth="7" strokeLinecap="butt" opacity=".85" />
    <path d="M23 14h20" stroke={accent} strokeDasharray="3 3" />
  </>,
};

export const ToolGlyph = ({ tool, size = 28 }: { tool: ToolId; size?: number }) => <svg
  className="fs-glyph"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  fill="none"
  strokeWidth={2.6}
  strokeLinecap="round"
  strokeLinejoin="round"
  aria-hidden="true"
>{GLYPHS[tool]}</svg>;

/** La ménsula: miembro vertical y dos voladizos cuyo peralte decrece hacia la punta. */
export const BrandMark = ({ size = 26 }: { size?: number }) => <svg className="fs-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
  <path className="fs-mark__body" d="M8 5h9v38H8z M17 5h24v5.5L17 14z" />
  <path className="fs-mark__arm" d="M17 21h17v5L17 30z" />
</svg>;
