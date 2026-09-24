import { RotateCcw } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { DesignCodeId } from '../../../design/elements/codes';

export interface WorkbenchChrome {
  /** Barra flotante de elementos y botón de cierre, propiedad de `DesignWorkbench`. */
  readonly overlay: ReactNode;
  readonly onStatus: (status: string, memo: string | null) => void;
  /** Norma de diseño elegida para todo el taller. */
  readonly code: DesignCodeId;
  /** Selector de norma, al inicio de cada formulario. */
  readonly codeControl: ReactNode;
}

export function WorkbenchLayout({ chrome, title, subtitle, inputs, stage, badge, results, status, memo, onReset }: {
  chrome: WorkbenchChrome;
  title: string;
  subtitle: string;
  inputs: ReactNode;
  stage: ReactNode;
  badge: ReactNode;
  results: ReactNode;
  status: string;
  memo: string | null;
  onReset: () => void;
}) {
  const { onStatus } = chrome;
  useEffect(() => onStatus(status, memo), [memo, onStatus, status]);
  return <div className="dw-layout">
    <form className="dw-inputs" aria-label="Datos del elemento" onSubmit={(event) => event.preventDefault()}>
      <header className="dw-inputs__head">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="dw-icon-button" onClick={onReset} aria-label="Restablecer el ejemplo" title="Restablecer el ejemplo">
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </header>
      {chrome.codeControl}
      {inputs}
    </form>
    <section className="dw-stage" aria-label="Lámina de diseño">
      <div className="dw-stage__scroll">{stage}</div>
      <div className="dw-stage__badge">{badge}</div>
      {chrome.overlay}
    </section>
    <section className="dw-results" aria-label="Resultados">{results}</section>
  </div>;
}

export function Plate({ title, note, wide = false, children }: { title: string; note?: string; wide?: boolean; children: ReactNode }) {
  return <figure className={`dw-plate${wide ? ' dw-plate--wide' : ''}`}>
    <figcaption><span className="dw-eyebrow">{title}</span>{note ? <small>{note}</small> : null}</figcaption>
    {children}
  </figure>;
}

export function StatusBadge({ status, label }: { status: 'pass' | 'fail' | 'warning' | 'error'; label: string }) {
  return <span className="dw-badge" data-status={status}><i aria-hidden="true" />{label}</span>;
}
