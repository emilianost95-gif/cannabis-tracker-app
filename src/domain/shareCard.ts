/**
 * Contenido de la tarjeta «Mi semana» para compartir. Solo incluye lo que la
 * persona elige; por defecto, lo positivo (días sin humo y racha). Nunca se
 * envía a ningún servidor: la imagen se genera en el dispositivo.
 */
import type { AppData, Currency } from './model';
import { entriesInPeriod, freeDays, previousWeeksAverage, realSpending, trackingStart } from './analytics';
import { computeAchievements } from './achievements';
import { addDaysKey, weekOf, type DayKey, type Period } from '@/utils/dates';

export interface ShareOptions {
  freeDays: boolean;
  streak: boolean;
  sessions: boolean;
  spending: boolean;
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = { freeDays: true, streak: true, sessions: false, spending: false };

export interface ShareStat {
  key: keyof ShareOptions;
  value: string;
  label: string;
}

export interface ShareContent {
  period: Period;
  stats: ShareStat[];
  headline: string;
}

export function shareCardContent(
  data: AppData,
  today: DayKey,
  opts: ShareOptions,
  fmt: { money: (minor: number, c: Currency) => string; number: (n: number) => string },
): ShareContent {
  const week = weekOf(today);
  const sofar: Period = { from: week.from, to: today };
  const start = trackingStart(data.consumption, data.checkins, data.expenses);
  const closed = today > week.from ? freeDays(data.consumption, { from: week.from, to: addDaysKey(today, -1) }, start) : null;
  const ach = computeAchievements(data, today);
  const sessions = entriesInPeriod(data.consumption, sofar).length;
  const avg = previousWeeksAverage(data.consumption, week.from, 4, start);
  const cur = data.preferences.currency;

  const stats: ShareStat[] = [];
  if (opts.freeDays) {
    stats.push({
      key: 'freeDays',
      value: closed && closed.tracked > 0 ? `${closed.free}/${closed.tracked}` : '—',
      label: 'días sin humo esta semana',
    });
  }
  if (opts.streak) {
    // Sin racha actual se muestra la mejor: la tarjeta celebra, no reta.
    const current = ach.currentFreeStreak > 0;
    const n = current ? ach.currentFreeStreak : ach.bestFreeStreak;
    stats.push({
      key: 'streak',
      value: fmt.number(n),
      label: current ? (n === 1 ? 'día de racha sin humo' : 'días de racha sin humo') : n === 1 ? 'día: mi mejor racha sin humo' : 'días: mi mejor racha sin humo',
    });
  }
  if (opts.sessions) {
    stats.push({
      key: 'sessions',
      value: fmt.number(sessions),
      label: avg !== null ? `sesiones (mi promedio: ${fmt.number(avg)})` : 'sesiones esta semana',
    });
  }
  if (opts.spending) {
    stats.push({ key: 'spending', value: fmt.money(realSpending(data.expenses, data.consumption, sofar)[cur] ?? 0, cur), label: 'en humo esta semana' });
  }

  const headline =
    ach.currentFreeStreak >= 7
      ? 'Una semana entera sin humo'
      : avg !== null && sessions < avg
        ? 'Bajando un cambio'
        : (closed?.free ?? 0) > 0
          ? 'A mi ritmo'
          : 'Mi semana en el Fumómetro';
  return { period: week, stats, headline };
}
