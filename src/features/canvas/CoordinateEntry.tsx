/**
 * Entrada por coordenadas.
 *
 * QUÉ SUSTITUYE. Una regleta (`quick-entry-bar`) que estaba SIEMPRE encendida
 * mientras la herramienta Nudo estuviera activa, anclada al borde inferior del
 * lienzo. En un teléfono no cabía —su composición móvil vivía en la hoja de
 * Resultados, que sólo se carga con el panel de Resultados, así que la regla
 * base de escritorio ganaba y la regleta se salía por la derecha— y en
 * escritorio ocupaba sitio sin que nadie la hubiera pedido.
 *
 * QUÉ ES AHORA. Una superficie que se abre desde un botón propio, junto a los
 * controles de cámara. Picar el lienzo sigue funcionando exactamente igual: el
 * teclado es una vía alternativa, no un modo.
 *
 * NO ES MODAL, Y ESO ES DELIBERADO. No usa `Dialog` ni `Drawer` —los dos son
 * `ModalSurface`, con trampa de foco, `aria-modal` y velo— porque el panel
 * enseña una PREVISUALIZACIÓN sobre el lienzo: un velo que atenúa lo que estás
 * mirando deja la previsualización sin trabajo, y una trampa de foco impide
 * seguir picando. Se cierra con Escape y con su propio botón.
 *
 * EL TECLADO PROPIO. En un teléfono el teclado del sistema tapa media pantalla
 * y con ella la previsualización. El panel trae doce teclas —dígitos, coma,
 * signo y borrar— y sus campos son de sólo lectura para el sistema
 * (`inputMode: 'none'`), así que el teclado nativo no sube. En pantalla ancha
 * hay teclado físico y las teclas no aparecen.
 *
 * TRES MODOS. Absoluto escribe el punto; Relativo lo escribe respecto a un
 * nudo de referencia; Polar lo escribe como distancia y ángulo desde ese mismo
 * nudo. Sin referencia, los dos últimos quedan deshabilitados en vez de
 * desaparecer: que existan es parte de saber que se puede.
 *
 * SIN SNAPPING, A PROPÓSITO. La ruta por puntero pasa por `snapPoint` porque un
 * dedo no acierta un decímetro. Un número escrito ya es exacto: redondearlo al
 * nodo más cercano sería descartar lo que la persona acaba de teclear.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowRight, Delete, Plus, X } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { CoordinateEntryGlyph } from '../../design-system/icons/structural';
import { IconButton } from '../../design-system/components/controls';
import { fromDisplay, toDisplay } from '../../engine/units';
import type { UnitSystemId } from '../../types';
import { parseLocalizedDecimal } from './quickEntry';
import { formatFixed } from '../../utils/numberFormat';

export type CoordinateMode = 'absolute' | 'relative' | 'polar';

/** El nudo desde el que se miden los modos relativo y polar. */
export interface CoordinateOrigin {
  x: number;
  y: number;
  /** Nombre visible del nudo, para que la referencia no sea implícita. */
  label: string;
}

export interface CoordinateEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `member` cierra la barra en curso; `node` coloca un nudo suelto. */
  target: 'node' | 'member';
  origin: CoordinateOrigin | null;
  units: UnitSystemId;
  lengthLabel: string;
  /** Punto resuelto, en unidades de MODELO. */
  onPlace: (point: { x: number; y: number }) => void;
  /** Punto resuelto o `null`, en unidades de MODELO, para el fantasma. */
  onPreviewChange: (point: { x: number; y: number } | null) => void;
  /** K0: añade el teclado propio y ancla el panel al borde inferior. */
  compact: boolean;
}

type Field = 'first' | 'second';

/** Las teclas del teclado propio, en el orden en que se dibujan. */
const KEYPAD = ['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const;

export const CoordinateEntry = ({
  open,
  onOpenChange,
  target,
  origin,
  units,
  lengthLabel,
  onPlace,
  onPreviewChange,
  compact,
}: CoordinateEntryProps) => {
  const { t } = useI18n();
  const panelId = useId();
  const [mode, setMode] = useState<CoordinateMode>('absolute');
  const [values, setValues] = useState({ first: '', second: '' });
  const [focused, setFocused] = useState<Field>('first');
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sin nudo de referencia no hay desde dónde medir: el modo vuelve solo a
  // Absoluto en vez de dejar el panel resolviendo contra un origen fantasma.
  const originAvailable = origin !== null;
  useEffect(() => {
    if (!originAvailable && mode !== 'absolute') setMode('absolute');
  }, [mode, originAvailable]);

  /** El punto que definen los dos campos, o `null` si aún no son dos números. */
  const resolve = (): { x: number; y: number } | null => {
    const first = parseLocalizedDecimal(values.first);
    const second = parseLocalizedDecimal(values.second);
    if (first === null || second === null) return null;
    if (mode === 'absolute') {
      return { x: fromDisplay(first, units, 'length'), y: fromDisplay(second, units, 'length') };
    }
    if (!origin) return null;
    if (mode === 'relative') {
      return {
        x: origin.x + fromDisplay(first, units, 'length'),
        y: origin.y + fromDisplay(second, units, 'length'),
      };
    }
    const length = fromDisplay(first, units, 'length');
    const radians = (second * Math.PI) / 180;
    return { x: origin.x + length * Math.cos(radians), y: origin.y + length * Math.sin(radians) };
  };

  const resolved = open ? resolve() : null;

  // La previsualización es un efecto porque vive en el lienzo, no aquí: el
  // panel dice cuál es el punto y el lienzo decide cómo dibujarlo.
  const previewX = resolved?.x ?? null;
  const previewY = resolved?.y ?? null;
  useEffect(() => {
    onPreviewChange(previewX === null || previewY === null ? null : { x: previewX, y: previewY });
    return () => onPreviewChange(null);
  }, [onPreviewChange, previewX, previewY]);

  useEffect(() => {
    if (!open) return;
    // Sólo se mueve el foco al abrir: el panel no es modal y no lo retiene.
    firstRef.current?.focus({ preventScroll: true });
    setFocused('first');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpenChange(false);
    };
    const node = panelRef.current;
    node?.addEventListener('keydown', onKeyDown);
    return () => node?.removeEventListener('keydown', onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  const setField = (field: Field, next: string) => {
    setValues((current) => ({ ...current, [field]: next }));
    setError('');
  };

  /** Una tecla del teclado propio escribe en el campo que tenga el foco. */
  const press = (key: string) => {
    setField(focused, (() => {
      const current = values[focused];
      if (key === 'backspace') return current.slice(0, -1);
      if (key === 'sign') return current.startsWith('-') ? current.slice(1) : `-${current}`;
      if (key === ',' && /[.,]/.test(current)) return current;
      return current + key;
    })());
  };

  const submit = () => {
    const point = resolve();
    if (!point) {
      setError(t('canvas.twoValidNumbers'));
      return;
    }
    onPlace(point);
    // «Colocar y seguir»: los campos se vacían y el panel se queda. Encadenar
    // una retícula de nudos es el caso normal, no la excepción.
    setValues({ first: '', second: '' });
    setError('');
    setFocused('first');
    firstRef.current?.focus({ preventScroll: true });
  };

  const polar = mode === 'polar';
  const relative = mode === 'relative';
  const firstLabel = polar ? 'L' : relative ? 'ΔX' : 'X';
  const secondLabel = polar ? '∠' : relative ? 'ΔY' : 'Y';
  const secondUnit = polar ? '°' : lengthLabel;

  const modes: readonly { id: CoordinateMode; label: string; enabled: boolean }[] = [
    { id: 'absolute', label: t('coord.absolute'), enabled: true },
    { id: 'relative', label: t('coord.relative'), enabled: originAvailable },
    { id: 'polar', label: t('coord.polar'), enabled: originAvailable },
  ];

  return <div
    ref={panelRef}
    id={panelId}
    className="coordinate-entry"
    data-coordinate-entry={compact ? 'sheet' : 'anchored'}
    role="group"
    aria-label={t('coord.title')}
  >
    <header className="coordinate-entry__head">
      <strong>{t(target === 'node' ? 'canvas.nodeByCoordinates' : 'canvas.memberEndpoint')}</strong>
      <IconButton size="sm" label={t('coord.close')} onClick={() => onOpenChange(false)}><X size={14} /></IconButton>
    </header>

    <div className="coordinate-entry__modes" role="group" aria-label={t('coord.mode')}>
      {modes.map((option) => <button
        key={option.id}
        type="button"
        disabled={!option.enabled}
        aria-pressed={mode === option.id}
        onClick={() => { setMode(option.id); setError(''); }}
      >{option.label}</button>)}
    </div>

    {/* La referencia se nombra siempre que se use: un «Δ» sin decir respecto a
        qué es una cifra sin sujeto. */}
    <p className="coordinate-entry__origin">
      {mode === 'absolute'
        ? t('coord.fromOrigin')
        : origin
          ? t('coord.fromNode', { node: origin.label })
          : t('coord.needsOrigin')}
    </p>

    <div className="coordinate-entry__fields">
      {(['first', 'second'] as const).map((field) => <label
        key={field}
        className={focused === field ? 'is-focused' : undefined}
      >
        <span>{field === 'first' ? firstLabel : secondLabel}</span>
        <input
          ref={field === 'first' ? firstRef : undefined}
          type="text"
          // En compacto el teclado del sistema taparía la previsualización, y
          // el panel trae el suyo. En ancho hay teclado físico.
          inputMode={compact ? 'none' : 'decimal'}
          readOnly={compact}
          autoComplete="off"
          value={values[field]}
          onFocus={() => setFocused(field)}
          onChange={(event) => setField(field, event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
        />
        <small>{field === 'first' ? lengthLabel : secondUnit}</small>
      </label>)}
      {/* Borrar edita un campo, así que vive con los campos. Sola en una cuarta
          fila del teclado dejaba dos huecos y 52px de hoja por nada. */}
      {compact ? <button
        type="button"
        className="coordinate-entry__erase"
        onClick={() => press('backspace')}
        aria-label={t('coord.backspace')}
      ><Delete size={17} /></button> : null}
    </div>

    {/* En relativo y en polar los campos NO dicen dónde acaba el punto. Y en un
        teléfono la hoja tapa buena parte del lienzo, así que el fantasma puede
        quedar detrás de ella. Esta línea hace comprobable el destino sin
        depender de verlo. */}
    {resolved ? <p className="coordinate-entry__resolved">
      <ArrowRight size={13} aria-hidden="true" />
      X {formatFixed(toDisplay(resolved.x, units, 'length'), 3)} · Y {formatFixed(toDisplay(resolved.y, units, 'length'), 3)} {lengthLabel}
    </p> : null}

    {compact ? <div className="coordinate-entry__keypad" role="group" aria-label={t('coord.keypad')}>
      {KEYPAD.map((key) => <button key={key} type="button" onClick={() => press(key)}>{key}</button>)}
      <button type="button" onClick={() => press('sign')} aria-label={t('coord.sign')}>±</button>
      <button type="button" onClick={() => press('0')}>0</button>
      <button type="button" onClick={() => press(',')} aria-label={t('coord.decimal')}>,</button>
    </div> : null}

    {error ? <p className="coordinate-entry__error" role="alert">{error}</p> : null}

    <button type="button" className="coordinate-entry__place" onClick={submit}>
      <Plus size={15} aria-hidden="true" />
      {t(target === 'node' ? 'coord.placeAndContinue' : 'canvas.createMember')}
    </button>
  </div>;
};

/** El botón que abre el panel. Vive con los controles de cámara del lienzo. */
export const CoordinateEntryTrigger = ({ open, onToggle }: { open: boolean; onToggle: () => void }) => {
  const { t } = useI18n();
  return <button
    type="button"
    className={`canvas-coordinate-trigger${open ? ' active' : ''}`}
    aria-label={t('coord.open')}
    title={t('coord.open')}
    aria-pressed={open}
    onClick={onToggle}
  ><CoordinateEntryGlyph size={19} /></button>;
};
