/**
 * Cantidades: solo se suman dentro de la misma unidad. No existe conversión
 * entre unidades (gramos, caladas, mg de THC, etc. no son equivalentes).
 */
import { UNITS, type Quantity, type Unit } from './model';

export type QuantityTotals = Partial<Record<Unit, number>>;

/** Suma por unidad. Internamente en milésimas enteras para evitar 0.1 + 0.2. */
export function sumByUnit(quantities: (Quantity | null)[]): QuantityTotals {
  const milli: Partial<Record<Unit, number>> = {};
  for (const q of quantities) {
    if (!q) continue;
    milli[q.unit] = (milli[q.unit] ?? 0) + Math.round(q.value * 1000);
  }
  const out: QuantityTotals = {};
  for (const u of UNITS) {
    const v = milli[u];
    if (v !== undefined) out[u] = v / 1000;
  }
  return out;
}

export class IncompatibleUnitsError extends Error {
  constructor(a: Unit, b: Unit) {
    super(`No se pueden sumar ${a} y ${b}`);
    this.name = 'IncompatibleUnitsError';
  }
}

/** Suma estricta de dos cantidades: lanza si las unidades difieren. */
export function addQuantities(a: Quantity, b: Quantity): Quantity {
  if (a.unit !== b.unit) throw new IncompatibleUnitsError(a.unit, b.unit);
  return { unit: a.unit, value: (Math.round(a.value * 1000) + Math.round(b.value * 1000)) / 1000 };
}

/** Unidades presentes en una lista, en el orden canónico. */
export function unitsPresent(quantities: (Quantity | null)[]): Unit[] {
  const set = new Set(quantities.filter((q): q is Quantity => q !== null).map((q) => q.unit));
  return UNITS.filter((u) => set.has(u));
}

/** Parsea "1,5" o "1.5" como número positivo. */
export function parseQuantityInput(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}
