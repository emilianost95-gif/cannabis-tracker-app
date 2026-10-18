/**
 * Reglas para crear y validar registros de consumo a partir de un formulario.
 * Independiente de React para poder probarlo de forma aislada.
 */
import {
  SCHEMA_VERSION,
  consumptionEntry,
  type ConsumptionEntry,
  type Context,
  type Currency,
  type Method,
  type Money,
  type Quantity,
  type ReferencePrice,
  type Unit,
} from './model';
import { parseMoneyInput, prorate } from './money';
import { parseQuantityInput } from './quantity';
import { localInputToIso } from '@/utils/dates';

/** Precio de referencia para la unidad de la cantidad, si existe. Nunca convierte entre unidades. */
export function estimateCost(q: Quantity | null, refs: ReferencePrice[]): Money | null {
  if (!q) return null;
  const ref = refs.find((r) => r.unit === q.unit);
  if (!ref) return null;
  return { currency: ref.price.currency, amountMinor: prorate(ref.price.amountMinor, q.value, ref.perQuantity) };
}

export type CostMode = 'none' | 'paid' | 'estimated';

export interface ConsumptionFormValues {
  occurredAtLocal: string;
  method: Method;
  quantityText: string;
  unit: Unit | null;
  context: Context | null;
  moodBefore: number | null;
  sleepQuality: number | null;
  stress: number | null;
  costMode: CostMode;
  costText: string;
  currency: Currency;
  notes: string;
}

export type FormErrors = Partial<Record<'occurredAt' | 'quantity' | 'unit' | 'cost' | 'notes' | 'form', string>>;

export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const EARLIEST_DATE = '2000-01-01T00:00:00.000Z';

export function buildConsumptionEntry(
  v: ConsumptionFormValues,
  opts: { existing?: ConsumptionEntry; referencePrices: ReferencePrice[]; now: Date; id: string },
): { ok: true; entry: ConsumptionEntry } | { ok: false; errors: FormErrors } {
  const errors: FormErrors = {};

  const occurredAt = localInputToIso(v.occurredAtLocal);
  if (!occurredAt) errors.occurredAt = 'Ingresá una fecha y hora válidas';
  else if (Date.parse(occurredAt) > opts.now.getTime() + FUTURE_TOLERANCE_MS)
    errors.occurredAt = 'La fecha no puede estar en el futuro';
  else if (occurredAt < EARLIEST_DATE) errors.occurredAt = 'La fecha es demasiado antigua';

  let quantity: Quantity | null = null;
  if (v.quantityText.trim() !== '') {
    const n = parseQuantityInput(v.quantityText);
    if (n === null) errors.quantity = 'Ingresá un número mayor que cero (por ejemplo 0,5)';
    else if (!v.unit) errors.unit = 'Elegí la unidad de esta cantidad';
    else quantity = { value: n, unit: v.unit };
  }

  let cost: ConsumptionEntry['cost'] = null;
  if (v.costMode === 'paid') {
    const r = parseMoneyInput(v.costText, v.currency);
    if (!r.ok) errors.cost = r.error;
    else if (r.amountMinor === 0) errors.cost = 'El importe debe ser mayor que cero';
    else cost = { kind: 'paid', amountMinor: r.amountMinor, currency: v.currency };
  } else if (v.costMode === 'estimated' && !errors.quantity && !errors.unit) {
    const est = estimateCost(quantity, opts.referencePrices);
    if (!est) errors.cost = 'Para estimar hace falta una cantidad con unidad que tenga precio de referencia';
    else cost = { kind: 'estimated', ...est };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const nowIso = opts.now.toISOString();
  const candidate: ConsumptionEntry = {
    id: opts.existing?.id ?? opts.id,
    schemaVersion: SCHEMA_VERSION,
    occurredAt: occurredAt!,
    method: v.method,
    quantity,
    context: v.context,
    moodBefore: v.moodBefore,
    sleepQuality: v.sleepQuality,
    stress: v.stress,
    cost,
    notes: v.notes.trim(),
    createdAt: opts.existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
  const parsed = consumptionEntry.safeParse(candidate);
  if (!parsed.success) {
    const out: FormErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'quantity') out.quantity = issue.message;
      else if (key === 'notes') out.notes = 'Las notas pueden tener como máximo 1000 caracteres';
      else if (key === 'cost') out.cost = issue.message;
      else if (key === 'occurredAt') out.occurredAt = issue.message;
      else out.form = issue.message;
    }
    return { ok: false, errors: out };
  }
  return { ok: true, entry: parsed.data };
}

export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/** Otro registro con el mismo formato a menos de 10 minutos: posible duplicado. */
export function findPossibleDuplicate(entries: ConsumptionEntry[], candidate: ConsumptionEntry): ConsumptionEntry | null {
  const t = Date.parse(candidate.occurredAt);
  return (
    entries.find(
      (e) =>
        e.id !== candidate.id &&
        e.method === candidate.method &&
        Math.abs(Date.parse(e.occurredAt) - t) <= DUPLICATE_WINDOW_MS &&
        (e.quantity?.unit ?? null) === (candidate.quantity?.unit ?? null) &&
        (e.quantity?.value ?? null) === (candidate.quantity?.value ?? null),
    ) ?? null
  );
}
