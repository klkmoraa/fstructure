import { DesignWorkbench } from '../design/workbench/DesignWorkbench';
import { AppShellLayout } from '../workspace/AppShellLayout';
import { ShellSlotHost, ShellToolSlotsProvider } from '../workspace/ShellToolSlots';
import { useShellComposition } from '../workspace/useShellComposition';
import '../../design-system/components/ui.css';
import '../workspace/phase1.css';
import '../workspace/workspaceTopbar.css';
import '../workspace/nativeWorkspaceMode.css';
import '../workspace/mesaChrome.css';
import { CALC_PIECES, type CalcPiece } from './pieces';

/**
 * Piezas completas sueltas: el mismo taller y la misma geometría de mesa que el
 * modo Diseño, sin el proyecto. Sus borradores y su memoria viven en este
 * navegador (almacenamiento local del taller), no en el proyecto abierto; no
 * hay Estructura ni modelo que leer.
 */
export default function PiecesView({ piece }: { piece: CalcPiece }) {
  const { shellClass } = useShellComposition();
  return <ShellToolSlotsProvider mobile={shellClass === 'K0'} tool={`calc-${piece}`}>
    <AppShellLayout
      projectId="calc"
      skipLabel="Saltar al taller"
      shellClass={shellClass}
      inspectorCollapsed
      console={null}
      topbar={<div className="fc-pieces__bar">
        <ShellSlotHost slot="status" />
        <span className="fc-pieces__grow"><small className="fc-pieces__note">Pieza suelta: se guarda en este navegador, fuera del proyecto.</small></span>
        <ShellSlotHost slot="controls" />
        <ShellSlotHost slot="action" />
      </div>}
      workspace={<section className="native-workspace-mode" data-workspace-mode="design" aria-label="Pieza suelta">
        <DesignWorkbench key={piece} scope="calc" elements={CALC_PIECES} startElement={piece} projectName="Cálculo" />
      </section>}
      inspector={null}
      floatingActions={<ShellSlotHost slot="mobile" />}
      instrument={<>
        <ShellSlotHost slot="statusbar" />
        <ShellSlotHost slot="dock" />
      </>}
    />
  </ShellToolSlotsProvider>;
}
