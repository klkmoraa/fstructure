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
 * EL TECLADO DEL TELÉFONO. Los campos usan el teclado del sistema, el
 * completo: se puede escribir «3,5» o «3,5 m». En el teléfono el panel sube con
 * el teclado (ver `mobileDock.css`) para que el campo y «Colocar» sigan a la
 * vista, y ↵ pasa de X a Y y coloca sin cerrar el teclado.
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
import { ArrowRight, Plus, X } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { CoordinateEntryGlyph } from '../../design-system/icons/structural';
import { IconButton } from '../../design-system/components/controls';
import { fromDisplay, toDisplay } from '../../foundation/units';
import type { UnitSystemId } from '../../foundation/units';
import { parseLocalizedDecimal } from './quickEntry';
import { formatFixed } from '../../utils/numberFormat';

type CoordinateMode = 'absolute' | 'relative' | 'polar';

/** Lo que el lienzo necesita para dibujar el punto antes de confirmarlo. */
export interface CoordinatePreview {
  point: { x: number; y: number };
  /** Sólo en Relativo y Polar: el nudo desde el que se está midiendo. */
  origin: { x: number; y: number } | null;
}

/** El nudo desde el que se miden los modos relativo y polar. */
export interface CoordinateOrigin {
  x: number;
  y: number;
  /** Nombre visible del nudo, para que la referencia no sea implícita. */
  label: string;
}

interface CoordinateEntryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `member` cierra la barra en curso; `node` coloca un nudo suelto. */
  target: 'node' | 'member';
  origin: CoordinateOrigin | null;
  units: UnitSystemId;
  lengthLabel: string;
  /** Coloca el punto resuelto, en unidades de MODELO.
   *
   *  Devuelve si el modelo lo ACEPTÓ. Colocar puede rechazarse —un extremo de
   *  barra que coincide con su origen— y sin esa respuesta el panel vaciaba los
   *  campos igual: el aviso llegaba con los números ya borrados y había que
   *  reescribir los dos para corregir uno. */
  onPlace: (point: { x: number; y: number }) => boolean | Promise<boolean>;
  /** El fantasma: el punto resuelto y, si el modo lo mide desde un nudo, el
   *  origen que de verdad se usó. En Absoluto el origen es `null` aunque haya un
   *  nudo seleccionado — dibujar la medida ahí haría leer un desplazamiento
   *  relativo donde el panel dice «desde el origen del modelo». */
  onPreviewChange: (preview: CoordinatePreview | null) => void;
  /** K0: ancla el panel al borde inferior, por encima del teclado. */
  compact: boolean;
}

type Field = 'first' | 'second';


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
  const secondRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sin nudo de referencia no hay desde dónde medir: el modo vuelve solo a
  // Absoluto en vez de dejar el panel resolviendo contra un origen fantasma.
  const originAvailable = origin !== null;
  useEffect(() => {
    if (!originAvailable && mode !== 'absolute') setMode('absolute');
  }, [mode, originAvailable]);

  /** El punto que definen los dos campos, o `null` si aún no son dos números. */
  const resolve = (): { x: number; y: number } | null => {
    const first = parseLocalizedDecimal(values.first, lengthLabel);
    const second = parseLocalizedDecimal(values.second, mode === 'polar' ? '°' : lengthLabel);
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
  // panel dice cuál es el punto y desde dónde lo mide, y el lienzo decide cómo
  // dibujarlo. El origen se manda desde aquí y no se deduce allí: el lienzo
  // conoce el nudo seleccionado pero no el modo, y en Absoluto ese nudo no es
  // el origen de nada.
  const midiendoDesdeOrigen = mode !== 'absolute' && origin !== null;
  const previewX = resolved?.x ?? null;
  const previewY = resolved?.y ?? null;
  const originX = midiendoDesdeOrigen ? origin.x : null;
  const originY = midiendoDesdeOrigen ? origin.y : null;
  useEffect(() => {
    onPreviewChange(previewX === null || previewY === null ? null : {
      point: { x: previewX, y: previewY },
      origin: originX === null || originY === null ? null : { x: originX, y: originY },
    });
    return () => onPreviewChange(null);
  }, [onPreviewChange, originX, originY, previewX, previewY]);

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

  const submit = async () => {
    const point = resolve();
    if (!point) {
      setError(t('canvas.twoValidNumbers'));
      return;
    }
    // Sólo se vacía si el modelo lo aceptó. Un extremo de barra que coincide con
    // su origen se rechaza, y borrar los campos ahí obliga a reescribir los dos
    // números para corregir uno.
    if (!(await onPlace(point))) return;
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

  const placeLabel = t(target === 'node' ? 'coord.placeAndContinue' : 'canvas.createMember');

  return <div
    ref={panelRef}
    id={panelId}
    className="coordinate-entry"
    data-coordinate-entry={compact ? 'sheet' : 'anchored'}
    data-target={target}
    role="group"
    aria-label={t(target === 'node' ? 'canvas.nodeByCoordinates' : 'canvas.memberEndpoint')}
  >
    <header className="coordinate-entry__head">
      <div className="coordinate-entry__modes" role="group" aria-label={t('coord.mode')}>
        {modes.map((option) => <button
          key={option.id}
          type="button"
          disabled={!option.enabled}
          aria-pressed={mode === option.id}
          // Cambiar de modo no se lleva el foco del campo: el teclado del
          // teléfono sigue arriba.
          onPointerDown={(event) => event.preventDefault()}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { setMode(option.id); setError(''); }}
        >{option.label}</button>)}
      </div>
      {/* La referencia se nombra siempre que se use: un «Δ» sin decir respecto
          a qué es una cifra sin sujeto. Basta el nombre del nudo. */}
      {mode !== 'absolute' && origin ? <span className="coordinate-entry__origin" title={t('coord.fromNode', { node: origin.label })}>{origin.label}</span> : null}
      <IconButton size="sm" label={t('coord.close')} onClick={() => onOpenChange(false)}><X size={15} /></IconButton>
    </header>

    <div className="coordinate-entry__fields">
      {(['first', 'second'] as const).map((field) => <label
        key={field}
        className={focused === field ? 'is-focused' : undefined}
      >
        <span>{field === 'first' ? firstLabel : secondLabel}</span>
        <input
          ref={field === 'first' ? firstRef : secondRef}
          type="text"
          // El teclado completo del teléfono: se puede escribir la unidad.
          inputMode="text"
          enterKeyHint={field === 'first' ? 'next' : 'go'}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={values[field]}
          onFocus={() => setFocused(field)}
          onChange={(event) => setField(field, event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            // ↵ en X pasa a Y si falta; si no, coloca. El teclado no se cierra.
            if (field === 'first' && values.second.trim() === '' && values.first.trim() !== '') {
              setFocused('second');
              secondRef.current?.focus({ preventScroll: true });
              return;
            }
            void submit();
          }}
        />
        <small>{field === 'first' ? lengthLabel : secondUnit}</small>
      </label>)}
    </div>

    {/* En relativo y en polar los campos NO dicen dónde acaba el punto, y en un
        teléfono el fantasma puede quedar detrás de la hoja. Esta línea hace
        comprobable el destino sin depender de verlo. */}
    {resolved && mode !== 'absolute' ? <p className="coordinate-entry__resolved">
      <ArrowRight size={13} aria-hidden="true" />
      X {formatFixed(toDisplay(resolved.x, units, 'length'), 3)} · Y {formatFixed(toDisplay(resolved.y, units, 'length'), 3)} {lengthLabel}
    </p> : null}

    {error ? <p className="coordinate-entry__error" role="alert">{error}</p> : null}

    <button type="button" className="coordinate-entry__place" onClick={() => { void submit(); }}>
      <Plus size={15} aria-hidden="true" />
      {placeLabel}
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
