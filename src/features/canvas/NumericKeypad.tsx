import { ArrowRight, CornerDownLeft, Delete } from 'lucide-react';
import './numericKeypad.css';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'backspace' | 'sign' | 'enter';

const ROWS = [['7', '8', '9'], ['4', '5', '6'], ['1', '2', '3']] as const;

/** Lo que una tecla le hace a un número escrito. ↵ no escribe: lo decide quien la usa. */
export const applyKeypadKey = (current: string, key: Exclude<KeypadKey, 'enter'>): string => {
  if (key === 'backspace') return current.slice(0, -1);
  if (key === 'sign') return current.startsWith('-') ? current.slice(1) : `-${current}`;
  if (key === ',' && /[.,]/.test(current)) return current;
  return current + key;
};

/**
 * Teclado numérico propio de la mesa en el teléfono. Los campos que lo usan son
 * de sólo lectura para el sistema (`inputMode: 'none'`): el teclado nativo no
 * sube, no tapa el lienzo y no empuja la página.
 *
 * Cuatro columnas: cifras y, a la derecha, borrar, signo y ↵. El cero ocupa dos
 * plazas, como en cualquier teclado numérico.
 */
export const NumericKeypad = ({ onPress, label, enterLabel, enterAdvances = false, labels }: {
  onPress: (key: KeypadKey) => void;
  label: string;
  enterLabel: string;
  /** ↵ pasa al campo siguiente en lugar de confirmar: cambia su glifo. */
  enterAdvances?: boolean;
  labels: { backspace: string; sign: string; decimal: string };
}) => <div className="num-keypad" role="group" aria-label={label}>
  {ROWS.map((row, index) => <div key={row.join('')} className="num-keypad__row">
    {row.map((key) => <button key={key} type="button" onClick={() => onPress(key)}>{key}</button>)}
    {index === 0 ? <button type="button" className="num-keypad__fn" onClick={() => onPress('backspace')} aria-label={labels.backspace}><Delete size={20} aria-hidden="true" /></button> : null}
    {index === 1 ? <button type="button" className="num-keypad__fn" onClick={() => onPress('sign')} aria-label={labels.sign}>±</button> : null}
    {index === 2 ? <button type="button" className="num-keypad__enter" onClick={() => onPress('enter')} aria-label={enterLabel} title={enterLabel}>
      {enterAdvances ? <ArrowRight size={22} aria-hidden="true" /> : <CornerDownLeft size={22} aria-hidden="true" />}
    </button> : null}
  </div>)}
  <button type="button" className="num-keypad__zero" onClick={() => onPress('0')}>0</button>
  <button type="button" onClick={() => onPress(',')} aria-label={labels.decimal}>,</button>
</div>;
