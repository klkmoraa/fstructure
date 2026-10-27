import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, RotateCcw, RotateCw, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { Selection } from '../../types';
import { useProject } from '../../store/ProjectContext';
import { useI18n } from '../../i18n/useI18n';
import { toDisplay } from '../../foundation/units';
import { unitLabel } from '../../engine/units';
import { beginLoadEdit, isLoadEditCurrent, prepareLoadEdit } from './loadEdit';
import { parseLocalizedDecimal } from './quickEntry';
import './mobileLoadEditor.css';

const copy = {
  es: { magnitude: 'Escribe una magnitud válida; el sentido se elige con las flechas.', direction: 'Escribe un ángulo válido en grados.', stale: 'La carga cambió. Ábrela de nuevo antes de editar.' },
  en: { magnitude: 'Enter a valid magnitude; use the arrows to choose its direction.', direction: 'Enter a valid angle in degrees.', stale: 'The load changed. Reopen it before editing.' },
} as const;

export function MobileLoadEditor({ selection, onClose }: { selection: NonNullable<Selection>; onClose: () => void }) {
  const { project, updateProject } = useProject();
  const { t, language } = useI18n();
  const [session] = useState(() => beginLoadEdit(project, selection));
  const [value, setValue] = useState(() => session ? String(toDisplay(session.initial.magnitude, session.units, session.initial.quantity)) : '');
  const [angle, setAngle] = useState(() => String(session?.initial.direction ?? -90));
  const [flipped, setFlipped] = useState(false);
  const [invalid, setInvalid] = useState<'magnitude' | 'direction' | 'stale' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const angleInput = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const current = session && selection.kind === session.selection.kind && 'id' in selection
    && selection.id === session.selection.id && isLoadEditCurrent(project, session);
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.select(); }, []);
  useEffect(() => { if (!current) onClose(); }, [current, onClose]);
  if (!session || !current) return null;
  const isMoment = session.initial.quantity === 'moment';
  const direction = parseLocalizedDecimal(angle, '°');
  const MomentIcon = session.initial.direction * (flipped ? -1 : 1) < 0 ? RotateCw : RotateCcw;
  const label = t('dock.loadValue', { load: session.selection.id });
  const apply = () => {
    const result = prepareLoadEdit(project, session, value, angle, flipped);
    if (!result.ok) {
      setInvalid(result.reason);
      (result.reason === 'direction' ? angleInput : input).current?.focus({ preventScroll: true });
      return;
    }
    updateProject(latest => {
      const checked = prepareLoadEdit(latest, session, value, angle, flipped);
      return checked.ok ? checked.project : latest;
    });
    onClose();
  };
  return <form className="mdock__editor" aria-label={label}
    onSubmit={event => { event.preventDefault(); apply(); }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    {isMoment ? <button type="button" className="mdock__key mdock__key--sm mdock__key--flip" aria-label={t('dock.flip')} title={t('dock.flip')} aria-pressed={flipped}
      onPointerDown={event => event.preventDefault()} onClick={() => setFlipped(v => !v)}><MomentIcon size={20} aria-hidden="true" /></button>
      : <div className="mdock__dirs" role="group" aria-label={t('dock.direction')}>
        {([['down', -90, ArrowDown], ['right', 0, ArrowRight], ['up', 90, ArrowUp], ['left', 180, ArrowLeft]] as const).map(([id, degrees, Icon]) =>
          <button key={id} type="button" className="mdock__key mdock__key--sm mdock__key--dir"
            aria-pressed={direction !== null && Math.abs(((direction % 360 - degrees + 540) % 360) - 180) < 1}
            aria-label={t(`dock.dir.${id}`)} title={t(`dock.dir.${id}`)}
            onPointerDown={event => event.preventDefault()} onClick={() => { setAngle(String(degrees)); if (invalid === 'direction') setInvalid(null); }}>
            <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>)}
        <label className="mdock__angle">
          <span aria-hidden="true">∠</span>
          <input ref={angleInput} type="text" inputMode="text" enterKeyHint="done" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
            aria-label={t('dock.angle')} aria-invalid={invalid === 'direction' || undefined} aria-describedby={invalid === 'direction' ? errorId : undefined}
            value={angle} onFocus={event => event.currentTarget.select()}
            onChange={event => { setAngle(event.target.value); if (invalid === 'direction') setInvalid(null); }} />
          <small>°</small>
        </label>
      </div>}
    <label className="mdock__editor-field">
      <input ref={input} type="text" inputMode="text" enterKeyHint="done" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false}
        aria-label={label} aria-invalid={invalid === 'magnitude' || undefined} aria-describedby={invalid === 'magnitude' ? errorId : undefined}
        value={value} onFocus={event => event.currentTarget.select()}
        onChange={event => { setValue(event.target.value); if (invalid === 'magnitude') setInvalid(null); }} />
      <small>{unitLabel(session.units, session.initial.quantity)}</small>
    </label>
    <button type="submit" className="mdock__key mdock__key--sm mdock__key--apply" aria-label={t('dock.apply')} title={t('dock.apply')}><Check size={19} strokeWidth={2.2} aria-hidden="true" /></button>
    <button type="button" className="mdock__key mdock__key--sm" aria-label={t('toolbar.close')} title={t('toolbar.close')} onClick={onClose}><X size={18} strokeWidth={2} aria-hidden="true" /></button>
    {invalid ? <p id={errorId} className="mdock__editor-error" role="alert">{copy[language][invalid]}</p> : null}
  </form>;
}
