/**
 * Evaluación de objetivos personales.
 *
 * Cada tipo de objetivo define su propia métrica, período y criterio:
 * - reduce_frequency: sesiones por semana ≤ máximo.
 * - spending_limit:   gasto real por semana/mes ≤ límite (en su moneda).
 * - free_days:        días sin consumo registrado por semana ≥ mínimo.
 * - daily_log:        días con algún registro por semana ≥ mínimo.
 * - pause:            ninguna sesión entre inicio y fin.
 * - observe:          completar N semanas de observación (sin meta de cantidad).
 *
 * Semanas de lunes a domingo. Si el objetivo empieza o termina a mitad de
 * semana, solo se consideran los días dentro del objetivo y las metas de días
 * se ajustan a los días disponibles.
 */
import type { ConsumptionEntry, ExpenseEntry, MoodCheckIn, PersonalGoal } from './model';
import { realSpending } from './analytics';
import {
  addDaysKey,
  dayKeyOfIso,
  daysBetweenInclusive,
  eachDayKey,
  monthOf,
  weekOf,
  type DayKey,
  type Period,
} from '@/utils/dates';

export type GoalStatus = 'met' | 'not_met' | 'in_progress' | 'paused' | 'not_started';

export interface GoalPeriodEval {
  period: Period;
  /** Días del período que cuentan para el objetivo (recortados al objetivo y a hoy). */
  window: Period;
  status: GoalStatus;
  value: number;
  target: number;
}

export interface GoalEvaluation {
  status: GoalStatus;
  /** Evaluaciones por semana/mes, más antigua primero (vacío para pausa/observación). */
  periods: GoalPeriodEval[];
  /** Evaluación del período en curso o resumen global. */
  current: GoalPeriodEval | null;
  /** Para pausa/observación: días transcurridos y totales. */
  progress?: { elapsedDays: number; totalDays: number; sessions?: number; loggedDays?: number };
}

export interface GoalData {
  consumption: ConsumptionEntry[];
  checkins: MoodCheckIn[];
  expenses: ExpenseEntry[];
}

export function goalEndKey(goal: PersonalGoal): DayKey | null {
  if (goal.target.type === 'observe') return addDaysKey(goal.startDate, goal.target.weeks * 7 - 1);
  return goal.endDate;
}

function isDayPaused(goal: PersonalGoal, day: DayKey, today: DayKey): boolean {
  return goal.pausedIntervals.some((iv) => day >= iv.from && day <= (iv.to ?? today));
}

function periodsFor(goal: PersonalGoal, last: DayKey): Period[] {
  const unit = goal.target.type === 'spending_limit' && goal.target.period === 'month' ? 'month' : 'week';
  const out: Period[] = [];
  let p = unit === 'month' ? monthOf(goal.startDate) : weekOf(goal.startDate);
  while (p.from <= last) {
    out.push(p);
    p = unit === 'month' ? monthOf(addDaysKey(p.to, 1)) : weekOf(addDaysKey(p.to, 1));
  }
  return out;
}

function countSessions(entries: ConsumptionEntry[], w: Period): number {
  return entries.filter((e) => {
    const k = dayKeyOfIso(e.occurredAt);
    return k >= w.from && k <= w.to;
  }).length;
}

export function evaluateGoal(goal: PersonalGoal, data: GoalData, today: DayKey): GoalEvaluation {
  const end = goalEndKey(goal);
  if (goal.startDate > today) return { status: 'not_started', periods: [], current: null };

  const last = end !== null && end < today ? end : today;
  const sessionDays = new Set(data.consumption.map((e) => dayKeyOfIso(e.occurredAt)));
  const loggedDays = new Set([...sessionDays, ...data.checkins.map((c) => dayKeyOfIso(c.occurredAt))]);
  const t = goal.target;

  if (t.type === 'pause' || t.type === 'observe') {
    const full: Period = { from: goal.startDate, to: end ?? today };
    const elapsed: Period = { from: goal.startDate, to: last };
    const elapsedDays = daysBetweenInclusive(elapsed);
    const totalDays = daysBetweenInclusive(full);
    const finished = end !== null && today > end;
    if (t.type === 'pause') {
      const sessions = countSessions(data.consumption, elapsed);
      const status: GoalStatus = goal.status === 'paused' ? 'paused' : finished ? (sessions === 0 ? 'met' : 'not_met') : 'in_progress';
      return {
        status,
        periods: [],
        current: { period: full, window: elapsed, status, value: sessions, target: 0 },
        progress: { elapsedDays, totalDays, sessions },
      };
    }
    const logged = eachDayKey(elapsed).filter((d) => loggedDays.has(d)).length;
    const status: GoalStatus = goal.status === 'paused' ? 'paused' : finished ? 'met' : 'in_progress';
    return {
      status,
      periods: [],
      current: { period: full, window: elapsed, status, value: logged, target: totalDays },
      progress: { elapsedDays, totalDays, loggedDays: logged },
    };
  }

  const periods: GoalPeriodEval[] = periodsFor(goal, last).map((period) => {
    const window: Period = {
      from: period.from < goal.startDate ? goal.startDate : period.from,
      to: period.to > last ? last : period.to,
    };
    const fullWindowTo = end !== null && end < period.to ? end : period.to;
    const ongoing = fullWindowTo > today;
    const windowDays = eachDayKey(window);
    const possibleDays = daysBetweenInclusive({ from: window.from, to: fullWindowTo });

    if (windowDays.every((d) => isDayPaused(goal, d, today))) {
      return { period, window, status: 'paused', value: 0, target: 0 };
    }

    let value: number;
    let target: number;
    let status: GoalStatus;
    switch (t.type) {
      case 'reduce_frequency': {
        value = countSessions(data.consumption, window);
        target = t.maxSessionsPerWeek;
        status = value > target ? 'not_met' : ongoing ? 'in_progress' : 'met';
        break;
      }
      case 'spending_limit': {
        value = realSpending(data.expenses, data.consumption, window)[t.limit.currency] ?? 0;
        target = t.limit.amountMinor;
        status = value > target ? 'not_met' : ongoing ? 'in_progress' : 'met';
        break;
      }
      case 'free_days':
      case 'daily_log': {
        const set = t.type === 'free_days' ? sessionDays : loggedDays;
        const hit = (d: DayKey) => (t.type === 'free_days' ? !set.has(d) : set.has(d));
        // El día de hoy todavía puede cambiar: no se cuenta como "libre" hasta que termine.
        const closedDays = windowDays.filter((d) => t.type === 'daily_log' || d < today);
        value = closedDays.filter(hit).length;
        const goalTarget = t.type === 'free_days' ? t.minFreeDaysPerWeek : t.minLoggedDaysPerWeek;
        target = Math.min(goalTarget, possibleDays);
        const stillOpen = possibleDays - closedDays.length;
        status = value >= target ? 'met' : value + stillOpen < target ? 'not_met' : 'in_progress';
        break;
      }
    }
    return { period, window, status, value, target };
  });

  const current = periods[periods.length - 1] ?? null;
  const finished = end !== null && today > end;
  let status: GoalStatus = current?.status ?? 'in_progress';
  if (goal.status === 'paused') status = 'paused';
  else if (finished) {
    const evaluated = periods.filter((p) => p.status !== 'paused');
    status = evaluated.length > 0 && evaluated.every((p) => p.status === 'met') ? 'met' : 'not_met';
  }
  return { status, periods, current };
}

/** Proporción de períodos cumplidos entre los ya cerrados (sin contar pausados ni en curso). */
export function complianceRate(ev: GoalEvaluation): { met: number; closed: number } {
  const closed = ev.periods.filter((p) => p.status === 'met' || p.status === 'not_met');
  return { met: closed.filter((p) => p.status === 'met').length, closed: closed.length };
}

/** Pausar: abre un intervalo desde hoy. Reanudar: lo cierra ayer (o lo descarta si empezó hoy). */
export function togglePause(g: PersonalGoal, today: DayKey, now: string): PersonalGoal {
  if (g.status === 'active') {
    return { ...g, status: 'paused', pausedIntervals: [...g.pausedIntervals, { from: today, to: null }], updatedAt: now };
  }
  const yesterday = addDaysKey(today, -1);
  const intervals = g.pausedIntervals
    .map((iv) => (iv.to === null ? { ...iv, to: yesterday } : iv))
    .filter((iv) => iv.to === null || iv.to >= iv.from);
  return { ...g, status: 'active', pausedIntervals: intervals, updatedAt: now };
}

