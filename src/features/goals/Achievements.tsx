import { Award, Lock, type LucideIcon } from 'lucide-react';
import { ACHIEVEMENT_INFO } from './achievementInfo';
import type { AchievementsSummary } from '@/domain/achievements';
import { cx } from '@/components/ui';
import { plural } from '@/i18n';

/** Medallón: hexágono con icono. Bloqueado = contorno punteado gris. */
function Medallion({ icon: Icon, unlocked }: { icon: LucideIcon; unlocked: boolean }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 56 56" className="absolute inset-0" aria-hidden>
        <path
          d="M28 3 50 15.5v25L28 53 6 40.5v-25Z"
          fill={unlocked ? 'rgb(182 243 106 / 0.12)' : 'transparent'}
          stroke={unlocked ? '#b6f36a' : '#3a3f46'}
          strokeWidth="2"
          strokeDasharray={unlocked ? undefined : '4 3'}
          strokeLinejoin="round"
        />
      </svg>
      <Icon aria-hidden size={22} className={unlocked ? 'relative text-accent' : 'relative text-fg-subtle'} />
    </span>
  );
}

export function AchievementsPanel({ summary }: { summary: AchievementsSummary }) {
  const unlocked = summary.achievements.filter((a) => a.unlocked).length;
  return (
    <section aria-labelledby="logros-title" className="card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="logros-title" className="flex items-center gap-2 text-sm font-semibold">
            <Award aria-hidden size={16} className="text-fg-subtle" /> Logros
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {unlocked} de {summary.achievements.length} desbloqueados. Solo cuentan días sin humo, metas cumplidas y constancia: nunca cuánto
            fumás.
          </p>
        </div>
        <dl className="flex gap-5 sm:text-right">
          <div>
            <dt className="text-xs text-fg-subtle">Racha actual sin humo</dt>
            <dd className="num text-xl font-semibold">{plural(summary.currentFreeStreak, 'día', 'días')}</dd>
          </div>
          <div>
            <dt className="text-xs text-fg-subtle">Mejor racha</dt>
            <dd className="num text-xl font-semibold">{plural(summary.bestFreeStreak, 'día', 'días')}</dd>
          </div>
        </dl>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.achievements.map((a) => {
          const info = ACHIEVEMENT_INFO[a.id];
          return (
            <li
              key={a.id}
              className={cx(
                'flex items-center gap-3 rounded-[var(--radius-md)] border p-3',
                a.unlocked ? 'border-[rgb(182_243_106/0.3)] bg-surface-2' : 'border-border',
              )}
            >
              <Medallion icon={a.unlocked ? info.icon : Lock} unlocked={a.unlocked} />
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-medium', a.unlocked ? 'text-fg' : 'text-fg-muted')}>
                  {info.title}
                  <span className="sr-only">{a.unlocked ? ' (desbloqueado)' : ' (bloqueado)'}</span>
                </p>
                <p className="text-xs text-fg-subtle">{info.how}</p>
                {!a.unlocked && a.target > 1 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                      <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.round((a.value / a.target) * 100)}%` }} />
                    </div>
                    <span className="num text-[0.7rem] text-fg-muted">
                      {a.value}/{a.target}
                    </span>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
