import { CircleCheck, CircleDashed, CircleDot, CirclePause, Clock } from 'lucide-react';
import type { GoalEvaluation, GoalStatus } from '@/domain/goals';
import type { PersonalGoal } from '@/domain/model';
import { Badge } from '@/components/ui';
import { formatMoney, formatMoneyObj, formatPeriod, plural, t } from '@/i18n';

const STATUS_STYLE: Record<GoalStatus, { tone: 'accent' | 'neutral' | 'cyan' | 'warn'; icon: typeof CircleCheck }> = {
  met: { tone: 'accent', icon: CircleCheck },
  not_met: { tone: 'neutral', icon: CircleDashed },
  in_progress: { tone: 'cyan', icon: CircleDot },
  paused: { tone: 'neutral', icon: CirclePause },
  not_started: { tone: 'neutral', icon: Clock },
};

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <Badge tone={s.tone} icon={s.icon}>
      {t.goalStatus[status]}
    </Badge>
  );
}

export function describeTarget(g: PersonalGoal): string {
  const tg = g.target;
  switch (tg.type) {
    case 'reduce_frequency':
      return `Como máximo ${plural(tg.maxSessionsPerWeek, 'sesión', 'sesiones')} por semana`;
    case 'spending_limit':
      return `Gasto real de hasta ${formatMoneyObj(tg.limit)} por ${tg.period === 'week' ? 'semana' : 'mes'}`;
    case 'free_days':
      return `Al menos ${plural(tg.minFreeDaysPerWeek, 'día', 'días')} sin consumo por semana`;
    case 'daily_log':
      return `Registrar algo al menos ${plural(tg.minLoggedDaysPerWeek, 'día', 'días')} por semana`;
    case 'pause':
      return g.endDate ? `Sin consumo del ${formatPeriod({ from: g.startDate, to: g.endDate })}` : 'Pausa';
    case 'observe':
      return `Observar durante ${plural(tg.weeks, 'semana', 'semanas')}, sin meta de cantidad`;
  }
}

/** Texto del avance actual. */
export function progressText(g: PersonalGoal, ev: GoalEvaluation): string {
  const c = ev.current;
  if (ev.status === 'not_started') return `Empieza el ${formatPeriod({ from: g.startDate, to: g.startDate })}`;
  if (!c) return '';
  const tg = g.target;
  const periodLabel = tg.type === 'spending_limit' && tg.period === 'month' ? 'Este mes' : 'Esta semana';
  switch (tg.type) {
    case 'reduce_frequency':
      return `${periodLabel}: ${c.value} de un máximo de ${c.target} ${c.target === 1 ? 'sesión' : 'sesiones'}`;
    case 'spending_limit':
      return `${periodLabel}: ${formatMoney(c.value, tg.limit.currency)} de ${formatMoney(c.target, tg.limit.currency)}`;
    case 'free_days':
      return `${periodLabel}: ${c.value} de ${c.target} días sin consumo (se cuentan los días ya terminados)`;
    case 'daily_log':
      return `${periodLabel}: ${c.value} de ${c.target} días con algún registro`;
    case 'pause':
      return `Día ${ev.progress?.elapsedDays} de ${ev.progress?.totalDays} · ${plural(ev.progress?.sessions ?? 0, 'sesión registrada', 'sesiones registradas')} en este período`;
    case 'observe':
      return `Día ${ev.progress?.elapsedDays} de ${ev.progress?.totalDays} · ${plural(ev.progress?.loggedDays ?? 0, 'día', 'días')} con registro`;
  }
}

/** Mensaje de continuidad, sin culpa. Solo cuando algo no salió como se planeaba. */
export function supportiveMessage(g: PersonalGoal, ev: GoalEvaluation): string | null {
  if (g.target.type === 'pause' && (ev.progress?.sessions ?? 0) > 0 && ev.status === 'in_progress') {
    return 'Registrar con honestidad también es avanzar. La pausa sigue disponible desde hoy, si querés retomarla.';
  }
  if (ev.current?.status === 'not_met' && ev.status !== 'paused') {
    return 'Esta vez no salió como lo planeaste. Es información útil, no un fracaso: el próximo período empieza de cero.';
  }
  return null;
}

/** Proporción para la barra de avance (0–1), o null si no aplica. */
export function progressRatio(g: PersonalGoal, ev: GoalEvaluation): number | null {
  const c = ev.current;
  if (!c) return null;
  switch (g.target.type) {
    case 'pause':
    case 'observe':
      return ev.progress ? ev.progress.elapsedDays / ev.progress.totalDays : null;
    case 'reduce_frequency':
    case 'spending_limit':
      return c.target > 0 ? Math.min(1, c.value / c.target) : c.value > 0 ? 1 : 0;
    case 'free_days':
    case 'daily_log':
      return c.target > 0 ? Math.min(1, c.value / c.target) : 1;
  }
}
