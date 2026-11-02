/**
 * Numeric and textual policy of the report.
 *
 * The report reads the same numbers the interface shows. Before 0.8.1 this module used
 * its own thresholds (1e-5/1e7 here, 1e-4/1e8 in `clearNumber`, 1e-4/1e7 on screen), so a
 * value could appear in three shapes across the app, the PDF and the annex.
 */
import type { DiagramQuantity, MemberLoad, ProjectModel } from '../../types';
import { unitLabel } from '../../engine/units';
import { toDisplay, type UnitQuantity } from '../../foundation/units';
import { memberAxis } from '../../graphics/structureGeometry';
import type { ModelIndex } from './reportContext';

export const safeFilename = (name: string): string => name
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9 _-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .toLowerCase() || 'fusionstructure-project';

/**
 * Cifras de memoria de cálculo: cuatro significativas (79.59 kN, 0.5392, 2.161 rad), enteros
 * desde mil (77 719 → 77719) y la notación científica escrita como en papel, `6.433 × 10^{−5}`
 * (el exponente se dibuja volado), nunca `6.43344e-5`. Un residuo de punto flotante (7.1e-15
 * donde el valor es cero) se escribe 0: ninguna magnitud en m, kN o rad lo necesita.
 */
const memoirNumber = (value: number, significant: number): string => {
  if (!Number.isFinite(value)) return 'n/d';
  if (Math.abs(value) < 1e-11) return '0';
  const digits = Math.max(1, Math.min(significant, 4));
  const magnitude = Math.abs(value);
  const strip = (text: string) => text.includes('.') ? text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '') : text;
  if (magnitude >= 1e6 || magnitude < 1e-3) {
    const [mantissa, rawExponent] = value.toExponential(digits - 1).split('e');
    const exponent = Number(rawExponent);
    return `${strip(mantissa!)} × 10^{${exponent < 0 ? '−' : ''}${Math.abs(exponent)}}`;
  }
  if (magnitude >= 1000) return String(Math.round(value));
  const text = strip(String(Number(value.toPrecision(digits))));
  return text === '-0' ? '0' : text;
};

export const number = (value: number, digits = 6): string => memoirNumber(value, digits);

export const clearNumber = (value: number, reference = 1, digits = 5): string => {
  const scale = Math.max(1, Math.abs(Number.isFinite(reference) ? reference : 1));
  if (Number.isFinite(value) && Math.abs(value) <= 1e-9 * scale) return '0';
  return memoirNumber(value, digits);
};

export const quantityUnit = (quantity: DiagramQuantity): UnitQuantity => quantity === 'moment' ? 'moment' : 'force';

export const formatPolynomial = (
  project: ProjectModel,
  quantity: DiagramQuantity,
  coefficients: readonly number[],
  variable = 's',
): string => {
  const xScale = toDisplay(1, project.settings.units, 'length');
  const yScale = toDisplay(1, project.settings.units, quantityUnit(quantity));
  const converted = coefficients.map((coefficient, power) => coefficient * yScale / xScale ** power);
  const reference = Math.max(1, ...converted.map((value) => Math.abs(value)));
  const terms: string[] = [];
  converted.forEach((coefficient, power) => {
    if (Math.abs(coefficient) <= reference * 1e-10) return;
    const sign = coefficient < 0 ? '-' : '+';
    const magnitude = clearNumber(Math.abs(coefficient), reference, 5);
    const factor = power === 0 ? magnitude : power === 1 ? `${magnitude} ${variable}` : `${magnitude} ${variable}^${power}`;
    terms.push(terms.length === 0 ? `${coefficient < 0 ? '-' : ''}${factor}` : `${sign} ${factor}`);
  });
  return terms.join(' ') || '0';
};
export const display = (project: ProjectModel, value: number, quantity: UnitQuantity): string =>
  `${number(toDisplay(value, project.settings.units, quantity))} ${unitLabel(project.settings.units, quantity)}`;

export const clearDisplay = (project: ProjectModel, value: number, quantity: UnitQuantity, reference = 1): string => {
  const displayValue = toDisplay(value, project.settings.units, quantity);
  const displayReference = Math.max(1, Math.abs(toDisplay(reference, project.settings.units, quantity)));
  return `${clearNumber(displayValue, displayReference)} ${unitLabel(project.settings.units, quantity)}`;
};

/**
 * Table variants of `display` and `clearDisplay`.
 *
 * Inside a table the unit belongs once in the header, not once per cell: repeating " kN" down
 * forty rows costs the column its alignment and tells the reader nothing new.
 */
export const unitFor = (project: ProjectModel, quantity: UnitQuantity): string => unitLabel(project.settings.units, quantity);

export const displayCell = (project: ProjectModel, value: number, quantity: UnitQuantity): string =>
  number(toDisplay(value, project.settings.units, quantity));

export const clearCell = (project: ProjectModel, value: number, quantity: UnitQuantity, reference = 1): string => {
  const displayValue = toDisplay(value, project.settings.units, quantity);
  const displayReference = Math.max(1, Math.abs(toDisplay(reference, project.settings.units, quantity)));
  return clearNumber(displayValue, displayReference);
};

const loadBasisLabel = (basis: MemberLoad['lengthBasis']): string => basis === 'horizontal'
  ? 'proyección horizontal'
  : basis === 'vertical' ? 'proyección vertical' : 'longitud real';

const flexibleMemberLength = (index: ModelIndex, memberId: string): number | undefined => {
  const member = index.member(memberId);
  if (!member) return undefined;
  const ni = index.node(member.i);
  const nj = index.node(member.j);
  if (!ni || !nj) return undefined;
  return memberAxis(member, ni, nj).flexibleLength;
};

export const memberLoadDescription = (project: ProjectModel, index: ModelIndex, load: MemberLoad): string => {
  const length = flexibleMemberLength(index, load.memberId);
  if (load.type === 'distributed') {
    const start = Math.min(load.start, load.end);
    const end = Math.max(load.start, load.end);
    const span = end - start;
    const interval = length !== undefined
      ? `dominio x/L=${number(start)} -> ${number(end)} (x=${display(project, start * length, 'length')} -> ${display(project, end * length, 'length')}; longitud real cargada=${display(project, span * length, 'length')}; cobertura=${number(span * 100)}%)`
      : `dominio x/L=${number(start)} -> ${number(end)} (cobertura=${number(span * 100)}%)`;
    const intensity = `qx=${display(project, load.qxStart ?? 0, 'distributedForce')} -> ${display(project, load.qxEnd ?? load.qxStart ?? 0, 'distributedForce')}, qy=${display(project, load.qyStart ?? 0, 'distributedForce')} -> ${display(project, load.qyEnd ?? load.qyStart ?? 0, 'distributedForce')}`;
    return `${interval}; base=${loadBasisLabel(load.lengthBasis)}; ${intensity}`;
  }
  const position = Math.min(1, Math.max(0, load.position ?? 0.5));
  const station = length !== undefined ? `x/L=${number(position)} (x=${display(project, position * length, 'length')})` : `x/L=${number(position)}`;
  return load.type === 'point'
    ? `${station}; Px=${display(project, load.px ?? 0, 'force')}, Py=${display(project, load.py ?? 0, 'force')}`
    : `${station}; M=${display(project, load.moment ?? 0, 'moment')}`;
};
