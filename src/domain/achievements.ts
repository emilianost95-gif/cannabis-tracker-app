/**
 * Logros y rachas.
 *
 * Regla de diseño: solo se premian días sin humo, metas cumplidas, bajar
 * respecto de tu propio promedio y registrar con constancia. Nunca la
 * cantidad consumida. Todo se calcula de tus datos: no se guarda nada aparte.
 */
import type { AppData } from './model';
import { realSpending, sessionsByDay, trackingStart } from './analytics';
import { complianceRate, evaluateGoal } from './goals';
import { addDaysKey, dayKeyOfIso, eachDayKey, monthOf, parseDayKey, weekOf, type DayKey } from '@/utils/dates';

export type AchievementId =
  | 'first_free_day'
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'free_weekend'
  | 'below_average'
  | 'goal_met'
  | 'goal_met_5'
  | 'log_7'
  | 'budget_month';

export interface Achievement {
  id: AchievementId;
  unlocked: boolean;
  /** Avance hacia el logro (value ≤ target cuando está bloqueado). */
  value: number;
  target: number;
}

export interface AchievementsSummary {
  /** Días terminados seguidos sin humo hasta ayer (0 si hoy ya hubo sesión). */
  currentFreeStreak: number;
  bestFreeStreak: number;
  freeDaysTotal: number;
  achievements: Achievement[];
}

/** Racha más larga de días que cumplen `pred` en una lista ordenada de días. */
function longestRun(days: DayKey[], pred: (d: DayKey) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const d of days) {
    cur = pred(d) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
}

export function computeAchievements(data: AppData, today: DayKey): AchievementsSummary {
  const start = trackingStart(data.consumption, data.checkins, data.expenses);
  const byDay = sessionsByDay(data.consumption);
  const yesterday = addDaysKey(today, -1);
  // Solo días ya terminados y registrados.
  const closed = start !== null && start <= yesterday ? eachDayKey({ from: start, to: yesterday }) : [];
  const isFree = (d: DayKey) => !byDay.has(d);

  let currentFreeStreak = 0;
  if (!byDay.has(today)) {
    for (let i = closed.length - 1; i >= 0 && isFree(closed[i]!); i--) currentFreeStreak++;
  }
  const bestFreeStreak = longestRun(closed, isFree);
  const freeDaysTotal = closed.filter(isFree).length;

  // Finde sin humo: sábado y domingo terminados, ambos sin sesiones.
  const closedSet = new Set(closed);
  const freeWeekends = closed.filter((d) => parseDayKey(d).getDay() === 0 && closedSet.has(addDaysKey(d, -1)) && isFree(d) && isFree(addDaysKey(d, -1))).length;

  // Semanas completas con menos sesiones que el promedio de las 4 completas anteriores.
  let belowAverageWeeks = 0;
  if (start !== null) {
    const firstFull = weekOf(start).from === start ? start : addDaysKey(weekOf(start).from, 7);
    const weeks: { from: DayKey; to: DayKey; n: number }[] = [];
    for (let w = firstFull; addDaysKey(w, 6) <= yesterday; w = addDaysKey(w, 7)) {
      const to = addDaysKey(w, 6);
      weeks.push({ from: w, to, n: eachDayKey({ from: w, to }).reduce((a, d) => a + (byDay.get(d) ?? 0), 0) });
    }
    weeks.forEach((wk, i) => {
      if (i < 4) return;
      const avg = weeks.slice(i - 4, i).reduce((a, x) => a + x.n, 0) / 4;
      if (wk.n < avg) belowAverageWeeks++;
    });
  }

  // Metas cumplidas: períodos cerrados cumplidos + pausas/observaciones terminadas.
  let goalsMet = 0;
  for (const g of data.goals) {
    const ev = evaluateGoal(g, data, today);
    if (ev.periods.length > 0) goalsMet += complianceRate(ev).met;
    else if (ev.status === 'met') goalsMet += 1;
  }

  // Constancia: días seguidos con registro personal. No cuentan las sesiones,
  // para que este logro nunca se pueda ganar fumando todos los días.
  const logged = new Set(data.checkins.map((c) => dayKeyOfIso(c.occurredAt)));
  const loggedRun = start !== null ? longestRun(eachDayKey({ from: start, to: today }), (d) => logged.has(d)) : 0;

  // Mes cerrado con gasto real dentro del presupuesto mensual actual.
  let budgetMonths = 0;
  const budget = data.preferences.budgets.monthly;
  if (budget && start !== null) {
    for (let m = monthOf(start); m.to < monthOf(today).from; m = monthOf(addDaysKey(m.to, 1))) {
      if (m.from < start) continue; // mes incompleto en datos
      const spent = realSpending(data.expenses, data.consumption, m)[budget.currency] ?? 0;
      if (spent <= budget.amountMinor) budgetMonths++;
    }
  }

  const a = (id: AchievementId, value: number, target: number): Achievement => ({
    id,
    unlocked: value >= target,
    value: Math.min(value, target),
    target,
  });

  return {
    currentFreeStreak,
    bestFreeStreak,
    freeDaysTotal,
    achievements: [
      a('first_free_day', freeDaysTotal, 1),
      a('streak_3', bestFreeStreak, 3),
      a('free_weekend', freeWeekends, 1),
      a('streak_7', bestFreeStreak, 7),
      a('below_average', belowAverageWeeks, 1),
      a('goal_met', goalsMet, 1),
      a('log_7', loggedRun, 7),
      a('streak_14', bestFreeStreak, 14),
      a('goal_met_5', goalsMet, 5),
      a('budget_month', budgetMonths, 1),
      a('streak_30', bestFreeStreak, 30),
    ],
  };
}
