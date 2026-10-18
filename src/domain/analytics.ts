/**
 * Métricas derivadas exclusivamente de los registros del usuario.
 * Funciones puras: sin acceso a almacenamiento ni a la interfaz.
 */
import type { ConsumptionEntry, Context, Currency, ExpenseEntry, MoodCheckIn, Unit } from './model';
import { CONTEXTS } from './model';
import { addToTotals, type MoneyTotals } from './money';
import { sumByUnit, type QuantityTotals } from './quantity';
import {
  addDaysKey,
  dayKeyOfIso,
  eachDayKey,
  weekOf,
  inPeriod,
  weeksIn,
  type DayKey,
  type Period,
  type ComparedRange,
} from '@/utils/dates';

export function entriesInPeriod(entries: ConsumptionEntry[], p: Period): ConsumptionEntry[] {
  return entries.filter((e) => inPeriod(dayKeyOfIso(e.occurredAt), p));
}

/** Primer día con algún registro (consumo, registro personal o gasto). null si no hay datos. */
export function trackingStart(
  consumption: ConsumptionEntry[],
  checkins: MoodCheckIn[],
  expenses: ExpenseEntry[] = [],
): DayKey | null {
  let min: DayKey | null = null;
  const consider = (k: DayKey) => {
    if (min === null || k < min) min = k;
  };
  consumption.forEach((e) => consider(dayKeyOfIso(e.occurredAt)));
  checkins.forEach((c) => consider(dayKeyOfIso(c.occurredAt)));
  expenses.forEach((x) => consider(x.date));
  return min;
}

export function sessionsByDay(entries: ConsumptionEntry[]): Map<DayKey, number> {
  const m = new Map<DayKey, number>();
  for (const e of entries) {
    const k = dayKeyOfIso(e.occurredAt);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export interface DayCount {
  day: DayKey;
  count: number;
  /** false si el día es anterior al inicio del registro (dato desconocido, no cero). */
  tracked: boolean;
}

export function dailyCounts(entries: ConsumptionEntry[], p: Period, start: DayKey | null): DayCount[] {
  const byDay = sessionsByDay(entries);
  return eachDayKey(p).map((day) => ({
    day,
    count: byDay.get(day) ?? 0,
    tracked: start !== null && day >= start,
  }));
}

export interface WeekCount {
  week: Period;
  count: number;
  /** Días de la semana dentro del período consultado y ya registrados. */
  trackedDays: number;
}

export function weeklyCounts(entries: ConsumptionEntry[], p: Period, start: DayKey | null): WeekCount[] {
  const byDay = sessionsByDay(entries);
  return weeksIn(p).map((week) => {
    let count = 0;
    let trackedDays = 0;
    for (const d of eachDayKey(week)) {
      if (!inPeriod(d, p)) continue;
      count += byDay.get(d) ?? 0;
      if (start !== null && d >= start) trackedDays++;
    }
    return { week, count, trackedDays };
  });
}

export interface FreeDaysResult {
  /** Días registrados sin ninguna sesión. */
  free: number;
  /** Días del período desde que empezó el registro. */
  tracked: number;
  /** Días del período anteriores al inicio del registro. */
  untracked: number;
}

export function freeDays(entries: ConsumptionEntry[], p: Period, start: DayKey | null): FreeDaysResult {
  const byDay = sessionsByDay(entries);
  let free = 0;
  let tracked = 0;
  let untracked = 0;
  for (const d of eachDayKey(p)) {
    if (start === null || d < start) {
      untracked++;
      continue;
    }
    tracked++;
    if (!byDay.has(d)) free++;
  }
  return { free, tracked, untracked };
}

export interface PeriodComparison {
  range: ComparedRange;
  current: number;
  previous: number;
  /** El período anterior está completamente cubierto por el registro. */
  previousComparable: boolean;
  delta: number;
}

export function comparePeriods(entries: ConsumptionEntry[], range: ComparedRange, start: DayKey | null): PeriodComparison {
  const current = entriesInPeriod(entries, range.current).length;
  const previous = entriesInPeriod(entries, range.previous).length;
  return {
    range,
    current,
    previous,
    previousComparable: start !== null && start <= range.previous.from,
    delta: current - previous,
  };
}

export interface ContextSlice {
  context: Context | null;
  count: number;
}

/** Distribución por contexto. `context: null` agrupa las sesiones sin contexto indicado. */
export function contextDistribution(entries: ConsumptionEntry[]): ContextSlice[] {
  const counts = new Map<Context | null, number>();
  for (const e of entries) counts.set(e.context, (counts.get(e.context) ?? 0) + 1);
  const out: ContextSlice[] = [];
  for (const c of CONTEXTS) {
    const n = counts.get(c);
    if (n) out.push({ context: c, count: n });
  }
  out.sort((a, b) => b.count - a.count);
  const unknown = counts.get(null);
  if (unknown) out.push({ context: null, count: unknown });
  return out;
}

export function quantityTotals(entries: ConsumptionEntry[]): { totals: QuantityTotals; withoutQuantity: number } {
  return {
    totals: sumByUnit(entries.map((e) => e.quantity)),
    withoutQuantity: entries.filter((e) => e.quantity === null).length,
  };
}

/** Cantidad diaria en una sola unidad. Días sin registros de esa unidad = 0 (si están registrados). */
export function dailyQuantity(entries: ConsumptionEntry[], p: Period, u: Unit): { day: DayKey; value: number }[] {
  const milli = new Map<DayKey, number>();
  for (const e of entries) {
    if (e.quantity?.unit !== u) continue;
    const k = dayKeyOfIso(e.occurredAt);
    milli.set(k, (milli.get(k) ?? 0) + Math.round(e.quantity.value * 1000));
  }
  return eachDayKey(p).map((day) => ({ day, value: (milli.get(day) ?? 0) / 1000 }));
}

// ---------- Gasto ----------

/**
 * Gasto real: compras registradas + importes de sesiones marcados como
 * "pagado en el momento". Los costes estimados NUNCA se suman aquí, para no
 * contar dos veces el producto que ya se registró como compra.
 */
export function realSpending(expenses: ExpenseEntry[], consumption: ConsumptionEntry[], p: Period): MoneyTotals {
  const totals: MoneyTotals = {};
  for (const x of expenses) if (inPeriod(x.date, p)) addToTotals(totals, x.amount);
  for (const e of consumption) {
    if (e.cost?.kind === 'paid' && inPeriod(dayKeyOfIso(e.occurredAt), p)) addToTotals(totals, e.cost);
  }
  return totals;
}

/** Valor estimado del producto usado en sesiones (informativo, no es gasto real). */
export function estimatedUsage(consumption: ConsumptionEntry[], p: Period): MoneyTotals {
  const totals: MoneyTotals = {};
  for (const e of consumption) {
    if (e.cost?.kind === 'estimated' && inPeriod(dayKeyOfIso(e.occurredAt), p)) addToTotals(totals, e.cost);
  }
  return totals;
}

export function dailySpending(
  expenses: ExpenseEntry[],
  consumption: ConsumptionEntry[],
  p: Period,
  c: Currency,
): { day: DayKey; amountMinor: number }[] {
  const byDay = new Map<DayKey, number>();
  const add = (k: DayKey, v: number) => byDay.set(k, (byDay.get(k) ?? 0) + v);
  for (const x of expenses) if (x.amount.currency === c && inPeriod(x.date, p)) add(x.date, x.amount.amountMinor);
  for (const e of consumption) {
    if (e.cost?.kind === 'paid' && e.cost.currency === c) {
      const k = dayKeyOfIso(e.occurredAt);
      if (inPeriod(k, p)) add(k, e.cost.amountMinor);
    }
  }
  return eachDayKey(p).map((day) => ({ day, amountMinor: byDay.get(day) ?? 0 }));
}

export function weeklySpending(
  expenses: ExpenseEntry[],
  consumption: ConsumptionEntry[],
  p: Period,
  c: Currency,
): { week: Period; amountMinor: number }[] {
  return weeksIn(p).map((week) => {
    const clipped: Period = { from: week.from < p.from ? p.from : week.from, to: week.to > p.to ? p.to : week.to };
    return { week, amountMinor: realSpending(expenses, consumption, clipped)[c] ?? 0 };
  });
}

export interface BudgetStatus {
  limitMinor: number;
  spentMinor: number;
  /** Positivo = margen restante; negativo = excedido. */
  remainingMinor: number;
  ratio: number;
}

export function budgetStatus(limitMinor: number, spentMinor: number): BudgetStatus {
  return {
    limitMinor,
    spentMinor,
    remainingMinor: limitMinor - spentMinor,
    ratio: limitMinor > 0 ? spentMinor / limitMinor : spentMinor > 0 ? Infinity : 0,
  };
}

// ---------- Registro personal ----------

export type CheckinMetric = 'mood' | 'stress' | 'sleep' | 'craving';

export interface AssociationGroup {
  days: number;
  average: number | null;
}

export interface AssociationResult {
  metric: CheckinMetric;
  withConsumption: AssociationGroup;
  withoutConsumption: AssociationGroup;
  /** true solo si cada grupo tiene al menos `minDays` días con dato. */
  sufficient: boolean;
}

export const MIN_ASSOCIATION_DAYS = 5;

/**
 * Compara el promedio diario de una métrica del registro personal entre días
 * con y sin consumo registrado. Describe una asociación en los registros; no
 * implica causalidad.
 */
export function checkinAssociation(
  consumption: ConsumptionEntry[],
  checkins: MoodCheckIn[],
  metric: CheckinMetric,
  p: Period,
  minDays = MIN_ASSOCIATION_DAYS,
): AssociationResult {
  const consumedDays = sessionsByDay(entriesInPeriod(consumption, p));
  const perDay = new Map<DayKey, { sum: number; n: number }>();
  for (const c of checkins) {
    const v = c[metric];
    if (v === null) continue;
    const k = dayKeyOfIso(c.occurredAt);
    if (!inPeriod(k, p)) continue;
    const cur = perDay.get(k) ?? { sum: 0, n: 0 };
    cur.sum += v;
    cur.n += 1;
    perDay.set(k, cur);
  }
  const withC: number[] = [];
  const withoutC: number[] = [];
  for (const [k, { sum, n }] of perDay) (consumedDays.has(k) ? withC : withoutC).push(sum / n);
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
  return {
    metric,
    withConsumption: { days: withC.length, average: avg(withC) },
    withoutConsumption: { days: withoutC.length, average: avg(withoutC) },
    sufficient: withC.length >= minDays && withoutC.length >= minDays,
  };
}

export function dailyCheckinSeries(
  checkins: MoodCheckIn[],
  p: Period,
): { day: DayKey; mood: number | null; stress: number | null; sleep: number | null; craving: number | null }[] {
  const acc = new Map<DayKey, Record<CheckinMetric, { s: number; n: number }>>();
  for (const c of checkins) {
    const k = dayKeyOfIso(c.occurredAt);
    if (!inPeriod(k, p)) continue;
    const row = acc.get(k) ?? { mood: { s: 0, n: 0 }, stress: { s: 0, n: 0 }, sleep: { s: 0, n: 0 }, craving: { s: 0, n: 0 } };
    for (const m of ['mood', 'stress', 'sleep', 'craving'] as const) {
      const v = c[m];
      if (v !== null) {
        row[m].s += v;
        row[m].n += 1;
      }
    }
    acc.set(k, row);
  }
  const val = (x: { s: number; n: number } | undefined) => (x && x.n ? Math.round((x.s / x.n) * 10) / 10 : null);
  return eachDayKey(p).map((day) => {
    const r = acc.get(day);
    return { day, mood: val(r?.mood), stress: val(r?.stress), sleep: val(r?.sleep), craving: val(r?.craving) };
  });
}

/** Promedio de sesiones por día sobre los días con datos (no sobre días desconocidos). */
export function averagePerDay(count: number, trackedDays: number): number {
  if (trackedDays <= 0) return 0;
  return Math.round((count / trackedDays) * 10) / 10;
}

// ---------- Patrones (gráficos adicionales) ----------

/** Sesiones por hora del día local (0–23). */
export function hourDistribution(entries: ConsumptionEntry[]): number[] {
  const out = Array.from({ length: 24 }, () => 0);
  for (const e of entries) out[new Date(e.occurredAt).getHours()]! += 1;
  return out;
}

/** Hora con más sesiones, o null si no hay datos. Empates: la más temprana. */
export function peakHour(hours: number[]): number | null {
  let best = -1;
  let max = 0;
  hours.forEach((n, h) => {
    if (n > max) {
      max = n;
      best = h;
    }
  });
  return best < 0 ? null : best;
}

/**
 * Promedio de sesiones por día de la semana (lunes primero), contando solo los
 * días con datos de ese día de la semana dentro del período.
 */
export function weekdayAverages(entries: ConsumptionEntry[], p: Period, start: DayKey | null): { weekday: number; average: number | null; days: number }[] {
  const byDay = sessionsByDay(entries);
  const acc = Array.from({ length: 7 }, () => ({ sum: 0, days: 0 }));
  for (const d of eachDayKey(p)) {
    if (start === null || d < start) continue;
    const wd = (new Date(`${d}T12:00:00`).getDay() + 6) % 7; // 0 = lunes
    acc[wd]!.sum += byDay.get(d) ?? 0;
    acc[wd]!.days += 1;
  }
  return acc.map((a, weekday) => ({ weekday, days: a.days, average: a.days ? Math.round((a.sum / a.days) * 10) / 10 : null }));
}

export interface MethodSlice {
  method: ConsumptionEntry['method'] | 'others';
  count: number;
}

/** Formatos más usados: los `top` primeros y el resto agrupado en "others". */
export function methodDistribution(entries: ConsumptionEntry[], top = 4): MethodSlice[] {
  const counts = new Map<ConsumptionEntry['method'], number>();
  for (const e of entries) counts.set(e.method, (counts.get(e.method) ?? 0) + 1);
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const head: MethodSlice[] = sorted.slice(0, top).map(([method, count]) => ({ method, count }));
  const rest = sorted.slice(top).reduce((a, [, c]) => a + c, 0);
  return rest > 0 ? [...head, { method: 'others', count: rest }] : head;
}

/** Gasto real acumulado día a día en una moneda. */
export function cumulativeSpending(
  expenses: ExpenseEntry[],
  consumption: ConsumptionEntry[],
  p: Period,
  c: Currency,
): { day: DayKey; amountMinor: number }[] {
  let acc = 0;
  return dailySpending(expenses, consumption, p, c).map((d) => ({ day: d.day, amountMinor: (acc += d.amountMinor) }));
}

/** Promedio semanal de sesiones en las `weeks` semanas completas anteriores a la actual. */
export function previousWeeksAverage(entries: ConsumptionEntry[], currentWeekStart: DayKey, weeks: number, start: DayKey | null): number | null {
  if (start === null) return null;
  const from = addDaysKey(currentWeekStart, -7 * weeks);
  // Solo semanas completamente registradas.
  const usable = weeksIn({ from: from < start ? weekStartKeyAfter(start) : from, to: addDaysKey(currentWeekStart, -1) }).filter(
    (w) => w.from >= start && w.to < currentWeekStart,
  );
  if (usable.length === 0) return null;
  const total = usable.reduce((a, w) => a + entriesInPeriod(entries, w).length, 0);
  return Math.round((total / usable.length) * 10) / 10;
}

function weekStartKeyAfter(d: DayKey): DayKey {
  const ws = weekOf(d).from;
  return ws === d ? d : addDaysKey(ws, 7);
}
