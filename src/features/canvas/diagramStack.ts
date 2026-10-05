

/** Axial, shear and moment are read at one shared station on the canvas. */
export type StackQuantity = 'axial' | 'shear' | 'moment';
export const STACK_QUANTITIES: readonly StackQuantity[] = ['axial', 'shear', 'moment'];
export const STACK_SYMBOLS: Readonly<Record<StackQuantity, string>> = { axial: 'N', shear: 'V', moment: 'M' };

const DIAGRAM_STACK_STORAGE_KEY = 'structureco:diagram-stack:v1';

/** Keep the stack useful and ordered even if an old preference is malformed. */
const parseStackQuantities = (raw: string | null): StackQuantity[] => {
  if (!raw) return [...STACK_QUANTITIES];
  try {
    const parsed: unknown = JSON.parse(raw);
    const chosen = Array.isArray(parsed) ? STACK_QUANTITIES.filter((item) => parsed.includes(item)) : [];
    return chosen.length ? chosen : [...STACK_QUANTITIES];
  } catch { return [...STACK_QUANTITIES]; }
};

export const readStoredStackQuantities = (): StackQuantity[] => {
  if (typeof window === 'undefined') return [...STACK_QUANTITIES];
  try { return parseStackQuantities(window.localStorage.getItem(DIAGRAM_STACK_STORAGE_KEY)); } catch { return [...STACK_QUANTITIES]; }
};

export const persistStackQuantities = (quantities: readonly StackQuantity[]): void => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(DIAGRAM_STACK_STORAGE_KEY, JSON.stringify(quantities)); } catch { /* Optional view preference. */ }
};

/** The last visible lane cannot be removed: an active empty ACM would be misleading. */
export const toggleStackQuantity = (current: readonly StackQuantity[], quantity: StackQuantity): StackQuantity[] => {
  if (current.includes(quantity) && current.length === 1) return [...current];
  const next = current.includes(quantity) ? current.filter((item) => item !== quantity) : [...current, quantity];
  return STACK_QUANTITIES.filter((item) => next.includes(item));
};
