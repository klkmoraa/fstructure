import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { SurfacePresentation } from '../workspace/surfacePresentation';
import type { CandidatePickerCycle, CandidatePickerState, CandidateTarget } from './candidatePicker';

interface CandidatePickerProps {
  state: CandidatePickerState;
  presentation: Extract<SurfacePresentation, 'floating' | 'sheet'>;
  onCycle: (direction: CandidatePickerCycle) => void;
  onSetActive: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  labelForCandidate?: (candidate: CandidateTarget) => string;
  labels?: { title: string; cancel: string; confirm: string };
}

const defaultLabelForCandidate = (candidate: CandidateTarget): string => {
  const kind = candidate.kind === 'node'
    ? 'Nodo'
    : candidate.kind === 'member'
      ? 'Miembro'
      : candidate.kind === 'nodalLoad'
        ? 'Carga nodal'
        : 'Carga de miembro';
  return `${kind} ${candidate.id}`;
};

const cycleForKey = (key: string): CandidatePickerCycle | null => {
  if (key === 'ArrowDown') return 'next';
  if (key === 'ArrowUp') return 'previous';
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
};

/** Local contextual selection UI. It previews; only its explicit confirmation writes selection upstream. */
export const CandidatePicker = ({
  state,
  presentation,
  onCycle,
  onSetActive,
  onConfirm,
  onCancel,
  labelForCandidate = defaultLabelForCandidate,
  labels = { title: 'Candidatos de selección', cancel: 'Cancelar', confirm: 'Seleccionar' },
}: CandidatePickerProps) => {
  const listboxRef = useRef<HTMLDivElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const active = state.candidates[state.activeIndex]!;
  const activeId = `candidate-option-${active.kind}-${active.id}`;

  useEffect(() => {
    listboxRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    activeOptionRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const cycle = cycleForKey(event.key);
    if (cycle) {
      event.preventDefault();
      event.stopPropagation();
      onCycle(cycle);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      onConfirm();
      return;
    }
  };

  return <section
    className={`candidate-picker candidate-picker-${presentation}`}
    data-candidate-picker
    data-surface-presentation={presentation}
    style={{ left: state.anchor.x, top: state.anchor.y, maxHeight: presentation === 'floating' ? `min(420px, calc(100% - ${state.anchor.y + 8}px))` : undefined }}
    aria-label={labels.title}
    onKeyDown={(event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onCancel();
    }}
  >
    <strong>{labels.title}</strong>
    <div
      ref={listboxRef}
      role="listbox"
      aria-label={labels.title}
      aria-activedescendant={activeId}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {state.candidates.map((candidate, index) => {
        const selected = index === state.activeIndex;
        return <button
          key={`${candidate.kind}:${candidate.id}`}
          ref={selected ? activeOptionRef : undefined}
          id={`candidate-option-${candidate.kind}-${candidate.id}`}
          type="button"
          role="option"
          tabIndex={-1}
          aria-selected={selected}
          data-minimum-target="44"
          data-candidate-active={selected ? 'true' : undefined}
          onClick={() => {
            onSetActive(index);
            listboxRef.current?.focus({ preventScroll: true });
          }}
        >{labelForCandidate(candidate)}</button>;
      })}
    </div>
    <footer>
      <button type="button" data-minimum-target="44" onClick={onCancel}>{labels.cancel}</button>
      <button type="button" data-minimum-target="44" onClick={onConfirm}>{labels.confirm}</button>
    </footer>
  </section>;
};
