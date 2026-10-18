import { CalendarCheck, Medal, Mountain, NotebookPen, PiggyBank, Sprout, Sun, Target, TrendingDown, Trophy, Wind, type LucideIcon } from 'lucide-react';
import type { AchievementId } from '@/domain/achievements';

/** Nombres, explicación e icono de cada logro. */
export const ACHIEVEMENT_INFO: Record<AchievementId, { title: string; how: string; icon: LucideIcon }> = {
  first_free_day: { title: 'Primer día sin humo', how: 'Terminá un día sin sesiones registradas.', icon: Sprout },
  streak_3: { title: 'Tres al hilo', how: 'Tres días seguidos sin humo.', icon: Wind },
  free_weekend: { title: 'Finde tranqui', how: 'Un sábado y domingo sin humo.', icon: Sun },
  streak_7: { title: 'Semana sin humo', how: 'Siete días seguidos sin humo.', icon: CalendarCheck },
  below_average: { title: 'Bajando un cambio', how: 'Una semana completa por debajo de tu promedio de las 4 anteriores.', icon: TrendingDown },
  goal_met: { title: 'Palabra cumplida', how: 'Cumplí una meta (una semana, un mes o una pausa).', icon: Target },
  log_7: { title: 'Bitácora al día', how: 'Siete días seguidos anotando cómo estás en el registro personal.', icon: NotebookPen },
  streak_14: { title: 'Quincena zen', how: 'Catorce días seguidos sin humo.', icon: Mountain },
  goal_met_5: { title: 'Constancia', how: 'Cumplí metas cinco veces.', icon: Medal },
  budget_month: { title: 'Billetera feliz', how: 'Un mes completo dentro de tu presupuesto mensual.', icon: PiggyBank },
  streak_30: { title: 'Mes sin humo', how: 'Treinta días seguidos sin humo.', icon: Trophy },
};

