// @vitest-environment jsdom
/**
 * La regleta a la que sustituye este panel no tenía prueba, y su aritmética
 * —tres modos, un origen que puede no existir y una conversión de unidades—
 * es justo lo que no se puede comprobar mirando una captura. Estas pruebas
 * cubren lo que produce un punto equivocado sin que se note: un signo, un
 * grado leído como radián, o un modo relativo resolviendo contra la nada.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../../data/defaultProject';
import { PROJECT_STORAGE_KEY } from '../../data/projectStorage';
import { ProjectProvider } from '../../store/ProjectContext';
import { CoordinateEntry } from './CoordinateEntry';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(createDefaultProject()));
});
afterEach(cleanup);

const N1 = { x: 2, y: 1, label: 'N1' };

const montar = (props: Partial<Parameters<typeof CoordinateEntry>[0]> = {}) => {
  const onPlace = vi.fn();
  const onPreviewChange = vi.fn();
  render(<ProjectProvider><CoordinateEntry
    open
    onOpenChange={() => undefined}
    target="node"
    origin={null}
    units="kN-m"
    lengthLabel="m"
    onPlace={onPlace}
    onPreviewChange={onPreviewChange}
    compact={false}
    {...props}
  /></ProjectProvider>);
  return { onPlace, onPreviewChange };
};

/** Los dos campos, en el orden en que se leen. */
const campos = () => screen.getAllByRole('textbox') as HTMLInputElement[];

describe('CoordinateEntry · el punto que produce', () => {
  it('en absoluto coloca el punto tal cual, sin ajustarlo a nada', async () => {
    // Un número escrito ya es exacto: si esto empezara a pasar por `snapPoint`,
    // escribir 3,25 colocaría un nudo en 3,3 sin decirlo.
    const { onPlace } = montar();
    const [x, y] = campos();
    await userEvent.type(x, '3,25');
    await userEvent.type(y, '-4');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).toHaveBeenCalledWith({ x: 3.25, y: -4 });
  });

  it('en relativo suma al nudo de referencia', async () => {
    const { onPlace } = montar({ origin: N1 });
    await userEvent.click(screen.getByRole('button', { name: 'Relativo' }));
    const [dx, dy] = campos();
    await userEvent.type(dx, '1,5');
    await userEvent.type(dy, '2');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).toHaveBeenCalledWith({ x: 3.5, y: 3 });
  });

  it('en polar lee el segundo campo en GRADOS, no en radianes', async () => {
    const { onPlace } = montar({ origin: N1 });
    await userEvent.click(screen.getByRole('button', { name: 'Polar' }));
    const [longitud, angulo] = campos();
    await userEvent.type(longitud, '2');
    await userEvent.type(angulo, '90');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    const punto = onPlace.mock.calls[0][0] as { x: number; y: number };
    expect(punto.x).toBeCloseTo(2, 10);
    expect(punto.y).toBeCloseTo(3, 10);
  });

  it('sin nudo de referencia, relativo y polar quedan deshabilitados y no ocultos', () => {
    montar();
    expect((screen.getByRole('button', { name: 'Relativo' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Polar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Absoluto' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no coloca nada mientras los dos campos no sean números', async () => {
    const { onPlace } = montar();
    await userEvent.type(campos()[0], '3');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('previsualiza el punto antes de confirmarlo, y lo retira al vaciarlo', async () => {
    // La previsualización es lo que hace comprobable un número escrito. Si deja
    // de emitirse, el panel vuelve a ser una caja donde se teclea a ciegas.
    const { onPreviewChange } = montar();
    const [x, y] = campos();
    await userEvent.type(x, '5');
    await userEvent.type(y, '6');
    expect(onPreviewChange).toHaveBeenLastCalledWith({ x: 5, y: 6 });
    await userEvent.clear(y);
    expect(onPreviewChange).toHaveBeenLastCalledWith(null);
  });

  it('convierte a unidades de modelo: en N-mm, 1000 escritos son 1 metro', async () => {
    // El panel escribe en las unidades del proyecto y el modelo vive en metros.
    // Sin esta conversión, cambiar de sistema de unidades movería la geometría.
    const { onPlace } = montar({ units: 'N-mm', lengthLabel: 'mm' });
    await userEvent.type(campos()[0], '1000');
    await userEvent.type(campos()[1], '0');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).toHaveBeenCalledWith({ x: 1, y: 0 });
  });

  it('deja los campos vacíos tras colocar, para encadenar el siguiente', async () => {
    const { onPlace } = montar();
    await userEvent.type(campos()[0], '1');
    await userEvent.type(campos()[1], '1');
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(campos().map((campo) => campo.value)).toEqual(['', '']);
  });
});

describe('CoordinateEntry · el teclado propio', () => {
  it('en compacto los campos no invocan el teclado del sistema', () => {
    // Ésta es toda la razón de tener teclado propio: el nativo taparía la
    // previsualización y empujaría la hoja fuera de la pantalla.
    montar({ compact: true });
    for (const campo of campos()) {
      expect(campo.readOnly).toBe(true);
      expect(campo.getAttribute('inputmode')).toBe('none');
    }
  });

  it('las teclas escriben en el campo con el foco, y el signo alterna', async () => {
    const { onPlace } = montar({ compact: true });
    const [x, y] = campos();
    await userEvent.click(x);
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: /signo/i }));
    await userEvent.click(y);
    await userEvent.click(screen.getByRole('button', { name: '7' }));
    await userEvent.click(screen.getByRole('button', { name: /separador decimal/i }));
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: /colocar/i }));
    expect(onPlace).toHaveBeenCalledWith({ x: -4, y: 7.5 });
  });

  it('no acepta un segundo separador decimal', async () => {
    montar({ compact: true });
    const [x] = campos();
    await userEvent.click(x);
    await userEvent.click(screen.getByRole('button', { name: '1' }));
    await userEvent.click(screen.getByRole('button', { name: /separador decimal/i }));
    await userEvent.click(screen.getByRole('button', { name: '2' }));
    await userEvent.click(screen.getByRole('button', { name: /separador decimal/i }));
    expect(campos()[0].value).toBe('1,2');
  });
});
