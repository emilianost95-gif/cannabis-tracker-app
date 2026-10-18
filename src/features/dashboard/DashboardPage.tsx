import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Award, CalendarDays, NotebookPen, X, Check, Flag, FlaskConical, Pencil, Plus, Target, Wallet } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button, Card, LinkButton, Stat, cx } from '@/components/ui';
import { Humito, HumitoSays, SmokeWisps, type HumitoMood } from '@/components/brand';
import { WeekGauge } from '@/components/patternCharts';
import { BarSeries } from '@/components/charts';
import {
  budgetStatus,
  comparePeriods,
  dailyCounts,
  entriesInPeriod,
  estimatedUsage,
  freeDays,
  previousWeeksAverage,
  quantityTotals,
  realSpending,
  trackingStart,
} from '@/domain/analytics';
import { evaluateGoal } from '@/domain/goals';
import { otherCurrencies, totalIn } from '@/domain/money';
import { UNITS } from '@/domain/model';
import { capitalize, formatDay, formatMoney, formatNumber, formatShortDay, formatTotals, plural, t } from '@/i18n';
import { addDaysKey, comparedRange, monthOf, weekOf } from '@/utils/dates';
import { TrendLine } from '@/features/analytics/Trend';
import { GoalStatusBadge, progressRatio, progressText } from '@/features/goals/goalView';
import { ACHIEVEMENT_INFO } from '@/features/goals/achievementInfo';
import { dismissNudge, shouldNudge } from '@/services/reminders';
import { dayKeyOfIso } from '@/utils/dates';
import { computeAchievements } from '@/domain/achievements';

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 6 ? 'Trasnochando' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
}

/** Lo que dice Humito: describe tus datos sin juzgar ni empujar a fumar. */
function humitoLine(week: number, avg: number | null, freeSoFar: number | null): { mood: HumitoMood; text: string } {
  if (week === 0) {
    return {
      mood: 'happy',
      text: freeSoFar ? `Semana sin humo hasta ahora: ${plural(freeSoFar, 'día', 'días')} y contando.` : 'Esta semana todavía no anotaste humo.',
    };
  }
  if (avg === null) return { mood: 'chill', text: `Vas ${plural(week, 'sesión', 'sesiones')} esta semana. Con un par de semanas más te muestro tu promedio.` };
  if (week < avg) return { mood: 'happy', text: `Vas ${week} esta semana y tu promedio venía en ${formatNumber(avg, 1)}. Tranqui, a tu ritmo.` };
  if (week > avg) return { mood: 'curious', text: `Vas ${week} esta semana; tu promedio era ${formatNumber(avg, 1)}. Es solo un dato, sin drama.` };
  return { mood: 'chill', text: `Vas ${week}, justo en tu promedio semanal.` };
}

export function DashboardPage() {
  const { data } = useData();
  const today = useToday();
  const prefs = data.preferences;
  const cur = prefs.currency;

  const m = useMemo(() => {
    const start = trackingStart(data.consumption, data.checkins, data.expenses);
    const todayP = { from: today, to: today };
    const week = weekOf(today);
    const weekSoFar = { from: week.from, to: today };
    const month = monthOf(today);
    const monthSoFar = { from: month.from, to: today };
    const last7 = { from: addDaysKey(today, -6), to: today };
    const todayEntries = entriesInPeriod(data.consumption, todayP);
    const closedWeekDays = today > week.from ? { from: week.from, to: addDaysKey(today, -1) } : null;
    return {
      start,
      todayCount: todayEntries.length,
      todayQty: quantityTotals(todayEntries),
      todaySpend: realSpending(data.expenses, data.consumption, todayP),
      weekCount: entriesInPeriod(data.consumption, weekSoFar).length,
      weekFree: closedWeekDays ? freeDays(data.consumption, closedWeekDays, start) : null,
      weekSpend: realSpending(data.expenses, data.consumption, weekSoFar),
      monthSpend: realSpending(data.expenses, data.consumption, monthSoFar),
      monthEstimated: estimatedUsage(data.consumption, monthSoFar),
      comparison: comparePeriods(data.consumption, comparedRange('7d', today), start),
      avg4: previousWeeksAverage(data.consumption, week.from, 4, start),
      achievements: computeAchievements(data, today),
      weekLimit: (() => {
        const g = data.goals.find((x) => x.status === 'active' && x.target.type === 'reduce_frequency');
        return g?.target.type === 'reduce_frequency' ? g.target.maxSessionsPerWeek : null;
      })(),
      last7: dailyCounts(data.consumption, last7, start),
      goals: data.goals
        .filter((g) => g.status === 'active')
        .map((g) => ({ g, ev: evaluateGoal(g, data, today) }))
        .slice(0, 3),
    };
  }, [data, today]);

  const isEmpty = data.consumption.length === 0 && data.checkins.length === 0 && data.expenses.length === 0;
  const name = prefs.displayName.trim();
  const line = humitoLine(m.weekCount, m.avg4, m.weekFree?.free ?? null);
  const [nudge, setNudge] = useState(() => shouldNudge(new Date(), today, data.checkins.some((c) => dayKeyOfIso(c.occurredAt) === today)));

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">
            {greeting(new Date())}
            {name ? `, ${name}` : ''} · ¿cómo viene la mano?
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{capitalize(formatDay(today))}</h1>
        </div>
        <div className="hidden sm:block">
          <LinkButton to="/registrar" variant="primary" icon={Plus}>
            Anotar sesión
          </LinkButton>
        </div>
      </header>

      {isEmpty ? (
        <div className="card relative overflow-hidden px-4 py-10 text-center sm:py-14">
          <SmokeWisps className="absolute inset-x-0 bottom-0 h-40 w-full" />
          <Humito mood="sleepy" className="relative mx-auto w-36" />
          <h2 className="relative mt-4 font-display text-2xl font-semibold">Todavía no hay humo por acá</h2>
          <p className="relative mx-auto mt-2 max-w-md text-sm text-fg-muted">
            Anotá tu primera sesión y el Fumómetro empieza a medir: cuánto, cuándo, en qué situación y cuánta plata se va en humo. Todo
            queda solo en este dispositivo.
          </p>
          <div className="relative mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <LinkButton to="/registrar" variant="primary" icon={Plus}>
              Anotar mi primera sesión
            </LinkButton>
            <LinkButton to="/demo" icon={FlaskConical}>
              Ver la demo
            </LinkButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-6">
          {nudge && (
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-border-strong bg-surface-2 px-3 py-2.5 text-sm lg:col-span-6" role="status">
              <Link to="/diario" className="flex items-center gap-2 text-fg hover:underline">
                <NotebookPen aria-hidden size={16} className="text-accent" />
                ¿Cómo estuvo el día? Anotalo en 10 segundos.
              </Link>
              <button
                type="button"
                aria-label="Ocultar por hoy"
                className="rounded p-1 text-fg-subtle hover:text-fg"
                onClick={() => {
                  dismissNudge(today);
                  setNudge(false);
                }}
              >
                <X aria-hidden size={16} />
              </button>
            </div>
          )}
          <section aria-labelledby="fumometro-semana" className="card relative overflow-hidden p-4 sm:p-6 lg:col-span-6">
            <SmokeWisps className="absolute inset-x-0 bottom-0 h-24 w-full" />
            <div className="relative grid items-center gap-6 md:grid-cols-[minmax(0,22rem)_1fr]">
              <div>
                <h2 id="fumometro-semana" className="eyebrow mb-2">
                  Fumómetro de la semana
                </h2>
                <WeekGauge
                  value={m.weekCount}
                  caption={`${m.weekCount} sesiones esta semana${m.avg4 !== null ? `, promedio anterior ${m.avg4}` : ''}${m.weekLimit !== null ? `, meta máximo ${m.weekLimit}` : ''}`}
                  markers={[
                    ...(m.avg4 !== null ? [{ value: m.avg4, label: `Tu promedio: ${formatNumber(m.avg4, 1)}/sem`, tone: 'cyan' as const }] : []),
                    ...(m.weekLimit !== null ? [{ value: m.weekLimit, label: `Tu meta: máx. ${m.weekLimit}`, tone: 'fg' as const }] : []),
                  ]}
                >
                  <p className="-mt-1 mb-2 text-center md:max-w-[22rem]">
                    <span className="num font-display text-4xl font-semibold text-fg">{m.weekCount}</span>{' '}
                    <span className="text-sm text-fg-muted">{m.weekCount === 1 ? 'sesión' : 'sesiones'} de lunes a hoy</span>
                  </p>
                </WeekGauge>
              </div>
              <div className="grid gap-5">
                <HumitoSays mood={line.mood}>{line.text}</HumitoSays>
                <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                  <Stat
                    label="Días sin humo"
                    value={m.weekFree && m.weekFree.tracked > 0 ? `${m.weekFree.free} de ${m.weekFree.tracked}` : '—'}
                    hint={
                      m.weekFree === null || m.weekFree.tracked === 0
                        ? 'Se cuentan los días ya terminados.'
                        : m.weekFree.untracked > 0
                          ? `${plural(m.weekFree.untracked, 'día', 'días')} sin datos no se cuentan.`
                          : 'Días ya terminados'
                    }
                  />
                  <Stat label="Plata en humo (semana)" value={formatMoney(totalIn(m.weekSpend, cur), cur)} hint="Gasto real registrado" />
                </div>
                <TrendLine c={m.comparison} />
              </div>
            </div>
          </section>

          <Card title="Hoy" icon={CalendarDays} className="lg:col-span-2">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Sesiones" value={m.todayCount} />
              <Stat
                label="Gasto real"
                value={formatMoney(totalIn(m.todaySpend, cur), cur)}
                hint={otherCurrencies(m.todaySpend, cur).length ? `También: ${formatTotals(m.todaySpend, cur)}` : undefined}
              />
            </div>
            <div className="mt-4 border-t border-border pt-3 text-sm text-fg-muted">
              {m.todayCount === 0 ? (
                'Sin sesiones registradas hoy.'
              ) : (
                <>
                  Cantidad:{' '}
                  {UNITS.filter((u) => m.todayQty.totals[u] !== undefined)
                    .map((u) => `${formatNumber(m.todayQty.totals[u]!, 3)} ${t.units[u].short}`)
                    .join(' · ') || 'sin cantidades'}
                  {m.todayQty.withoutQuantity > 0 && ` · ${plural(m.todayQty.withoutQuantity, 'sesión', 'sesiones')} sin cantidad`}
                </>
              )}
            </div>
          </Card>

          <Card
            title="Últimos 7 días"
            icon={CalendarDays}
            className="lg:col-span-4"
            action={
              <Link to="/estadisticas" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                Estadísticas <ArrowRight aria-hidden size={14} />
              </Link>
            }
          >
            <BarSeries
              height={150}
              caption="Sesiones por día en los últimos 7 días"
              valueHeader="Sesiones"
              format={(v) => formatNumber(v, 0)}
              points={m.last7.map((d) => ({
                label: capitalize(formatDay(d.day, 'EEEEEE')),
                fullLabel: capitalize(formatDay(d.day)),
                value: d.count,
                muted: !d.tracked,
              }))}
            />
          </Card>

          <Card
            title="Gasto del mes"
            icon={Wallet}
            className="lg:col-span-2"
            action={
              <Link to="/gastos" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                Gastos <ArrowRight aria-hidden size={14} />
              </Link>
            }
          >
            <SpendBudget
              spent={totalIn(m.monthSpend, cur)}
              limit={prefs.budgets.monthly?.currency === cur ? prefs.budgets.monthly.amountMinor : null}
              currency={cur}
            />
            {otherCurrencies(m.monthSpend, cur).length > 0 && (
              <p className="mt-2 text-xs text-fg-subtle">Otras monedas (sin convertir): {formatTotals(m.monthSpend, cur)}</p>
            )}
            {totalIn(m.monthEstimated, cur) > 0 && (
              <p className="mt-2 text-xs text-fg-subtle">
                Valor estimado de lo usado: {formatMoney(totalIn(m.monthEstimated, cur), cur)} (no es gasto adicional).
              </p>
            )}
          </Card>

          <Card
            title="Objetivos"
            icon={Target}
            className="lg:col-span-4"
            action={
              <Link to="/objetivos" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                Ver todos <ArrowRight aria-hidden size={14} />
              </Link>
            }
          >
            {m.goals.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
                <span>No tenés objetivos activos. Son opcionales.</span>
                <LinkButton to="/objetivos" size="sm">
                  Crear objetivo
                </LinkButton>
              </div>
            ) : (
              <ul className="grid gap-4">
                {m.goals.map(({ g, ev }) => {
                  const ratio = progressRatio(g, ev);
                  return (
                    <li key={g.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-fg">{g.title}</span>
                        <GoalStatusBadge status={ev.status === 'paused' ? 'paused' : (ev.current?.status ?? ev.status)} />
                      </div>
                      {ratio !== null && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                          <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.round(ratio * 100)}%` }} />
                        </div>
                      )}
                      <p className="mt-1.5 text-xs text-fg-muted">{progressText(g, ev)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <NextAction className="lg:col-span-2" />

          <Card
            title="Racha sin humo"
            icon={Award}
            className="lg:col-span-4"
            action={
              <Link to="/objetivos" className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
                Logros <ArrowRight aria-hidden size={14} />
              </Link>
            }
          >
            <div className="flex flex-wrap items-center gap-6">
              <Stat
                label="Racha actual"
                value={plural(m.achievements.currentFreeStreak, 'día', 'días')}
                hint={`Mejor racha: ${plural(m.achievements.bestFreeStreak, 'día', 'días')}`}
              />
              <ul className="flex flex-wrap gap-2" aria-label="Logros desbloqueados">
                {m.achievements.achievements.filter((a) => a.unlocked).length === 0 ? (
                  <li className="text-sm text-fg-muted">Tu primer logro llega con el primer día sin humo.</li>
                ) : (
                  m.achievements.achievements
                    .filter((a) => a.unlocked)
                    .slice(-4)
                    .map((a) => {
                      const Info = ACHIEVEMENT_INFO[a.id];
                      return (
                        <li key={a.id} className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(182_243_106/0.3)] bg-accent-soft px-2.5 py-1 text-xs text-fg">
                          <Info.icon aria-hidden size={14} className="text-accent" />
                          {Info.title}
                        </li>
                      );
                    })
                )}
              </ul>
            </div>
          </Card>
        </div>
      )}
      {!isEmpty && (
        <p className="mt-6 text-xs text-fg-subtle">
          Registro desde el {m.start ? formatShortDay(m.start) : '—'}. Los días anteriores se muestran como «sin datos», no como cero.
        </p>
      )}
    </>
  );
}

function SpendBudget({ spent, limit, currency }: { spent: number; limit: number | null; currency: Parameters<typeof formatMoney>[1] }) {
  if (limit === null) {
    return (
      <>
        <Stat label="Gasto real (del 1 a hoy)" value={formatMoney(spent, currency)} />
        <Link to="/gastos" className="mt-2 inline-block text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline">
          Definir un presupuesto mensual
        </Link>
      </>
    );
  }
  const b = budgetStatus(limit, spent);
  const over = b.remainingMinor < 0;
  return (
    <>
      <Stat
        label="Gasto real (del 1 a hoy)"
        value={formatMoney(spent, currency)}
        hint={`Presupuesto: ${formatMoney(limit, currency)}`}
      />
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cx('h-full rounded-full', over ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, Math.round(b.ratio * 100))}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-fg-muted">
        {over ? `Superaste el presupuesto por ${formatMoney(-b.remainingMinor, currency)}` : `Quedan ${formatMoney(b.remainingMinor, currency)}`}
      </p>
    </>
  );
}

function NextAction({ className }: { className?: string }) {
  const { data, savePreferences } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data.preferences.nextAction);
  const current = data.preferences.nextAction;

  async function onSave() {
    try {
      await savePreferences({ ...data.preferences, nextAction: text.trim().slice(0, 140), updatedAt: new Date().toISOString() });
      setEditing(false);
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
  }

  return (
    <Card title="Mi próxima acción" icon={Flag} className={className}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
          className="grid gap-2"
        >
          <label htmlFor="next-action" className="sr-only">
            Mi próxima acción
          </label>
          <input
            id="next-action"
            className="field-input text-sm"
            maxLength={140}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ej.: Hoy no compro / Salgo a caminar después de cenar"
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" icon={Check}>
              Guardar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setText(current);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-3">
          <p className={current ? 'text-sm text-fg' : 'text-sm text-fg-muted'}>
            {current || 'Opcional: una intención concreta para los próximos días, con tus palabras.'}
          </p>
          <Button size="sm" icon={Pencil} onClick={() => setEditing(true)} className="justify-self-start">
            {current ? 'Cambiar' : 'Escribir una'}
          </Button>
        </div>
      )}
    </Card>
  );
}
