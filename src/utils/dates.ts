/**
 * Utilidades de calendario local.
 *
 * Los instantes se guardan en UTC (ISO). Toda agregación por día/semana/mes se
 * hace en la zona horaria del dispositivo, usando aritmética de calendario
 * (date-fns) y nunca sumando 86 400 000 ms, para que los cambios de horario de
 * verano no muevan registros de día.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** Fecha local YYYY-MM-DD. Comparable lexicográficamente. */
export type DayKey = string;

/** Período cerrado [from, to] en días locales. */
export interface Period {
  from: DayKey;
  to: DayKey;
}

export const WEEK_STARTS_ON = 1 as const; // lunes

export function dayKey(d: Date): DayKey {
  return format(d, 'yyyy-MM-dd');
}

export function dayKeyOfIso(iso: string): DayKey {
  return dayKey(new Date(iso));
}

/** Medianoche local del día indicado. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDaysKey(key: DayKey, n: number): DayKey {
  return dayKey(addDays(parseDayKey(key), n));
}

export function daysBetweenInclusive(p: Period): number {
  return differenceInCalendarDays(parseDayKey(p.to), parseDayKey(p.from)) + 1;
}

export function eachDayKey(p: Period): DayKey[] {
  const out: DayKey[] = [];
  if (p.to < p.from) return out;
  let cur = parseDayKey(p.from);
  const end = p.to;
  for (let k = dayKey(cur); k <= end; cur = addDays(cur, 1), k = dayKey(cur)) out.push(k);
  return out;
}

export function weekStartKey(key: DayKey): DayKey {
  return dayKey(startOfWeek(parseDayKey(key), { weekStartsOn: WEEK_STARTS_ON }));
}

export function weekOf(key: DayKey): Period {
  const from = weekStartKey(key);
  return { from, to: addDaysKey(from, 6) };
}

export function monthOf(key: DayKey): Period {
  const d = parseDayKey(key);
  return { from: dayKey(startOfMonth(d)), to: dayKey(endOfMonth(d)) };
}

export function inPeriod(key: DayKey, p: Period): boolean {
  return key >= p.from && key <= p.to;
}

export function clampPeriod(p: Period, maxTo: DayKey): Period {
  return { from: p.from, to: p.to > maxTo ? maxTo : p.to };
}

/** Semanas (lunes–domingo) que tocan el período, en orden. */
export function weeksIn(p: Period): Period[] {
  const out: Period[] = [];
  let start = weekStartKey(p.from);
  while (start <= p.to) {
    out.push({ from: start, to: addDaysKey(start, 6) });
    start = addDaysKey(start, 7);
  }
  return out;
}

export type RangePreset = '7d' | '30d' | '90d' | 'month';

export interface ComparedRange {
  current: Period;
  previous: Period;
}

/**
 * Rango actual y anterior comparables.
 * - Nd: últimos N días incluyendo hoy, contra los N días inmediatamente anteriores.
 * - month: del 1 del mes a hoy, contra el mismo tramo del mes anterior
 *   (si el mes anterior es más corto, se recorta a su último día).
 */
export function comparedRange(preset: RangePreset, today: DayKey): ComparedRange {
  if (preset === 'month') {
    const t = parseDayKey(today);
    const from = dayKey(startOfMonth(t));
    const prevStart = startOfMonth(addMonths(t, -1));
    const prevDay = Math.min(t.getDate(), getDaysInMonth(prevStart));
    const prevTo = new Date(prevStart.getFullYear(), prevStart.getMonth(), prevDay);
    return { current: { from, to: today }, previous: { from: dayKey(prevStart), to: dayKey(prevTo) } };
  }
  const n = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const from = addDaysKey(today, -(n - 1));
  return {
    current: { from, to: today },
    previous: { from: addDaysKey(from, -n), to: addDaysKey(from, -1) },
  };
}

/** Convierte un valor de <input type="datetime-local"> (hora local) a ISO UTC. */
export function localInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as number[] as [number, number, number, number, number, number];
  const dt = new Date(y, mo - 1, d, h, mi);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt.toISOString();
}

export function isoToLocalInput(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}
