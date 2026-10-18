import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, Flag, Leaf, Pencil, Plus, Target, Wallet } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button, Card, EmptyState, LinkButton, Stat, cx } from '@/components/ui';
import { BarSeries } from '@/components/charts';
import {
  budgetStatus,
  comparePeriods,
  dailyCounts,
  entriesInPeriod,
  estimatedUsage,
  freeDays,
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

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
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
      last7: dailyCounts(data.consumption, last7, start),
      goals: data.goals
        .filter((g) => g.status === 'active')
        .map((g) => ({ g, ev: evaluateGoal(g, data, today) }))
        .slice(0, 3),
    };
  }, [data, today]);

  const isEmpty = data.consumption.length === 0 && data.checkins.length === 0 && data.expenses.length === 0;
  const name = prefs.displayName.trim();

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">
            {greeting(new Date())}
            {name ? `, ${name}` : ''}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{capitalize(formatDay(today))}</h1>
        </div>
        <LinkButton to="/registrar" variant="primary" icon={Plus} className="hidden sm:inline-flex">
          Registrar consumo
        </LinkButton>
      </header>

      {isEmpty ? (
        <div className="card">
          <EmptyState
            icon={Leaf}
            title="Tu registro empieza acá"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <LinkButton to="/registrar" variant="primary" icon={Plus}>
                  Registrar un consumo
                </LinkButton>
                <LinkButton to="/diario">Anotar cómo estoy</LinkButton>
              </div>
            }
          >
            Cuando registres tu primera sesión, este panel mostrará tu frecuencia, tu gasto y cómo avanzan tus objetivos. Todo se
            calcula con tus datos y se guarda solo en este dispositivo.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-6">
          <Card title="Hoy" icon={CalendarDays} className="lg:col-span-3">
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

          <Card title="Esta semana" icon={CalendarDays} className="lg:col-span-3">
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Sesiones (lun. a hoy)" value={m.weekCount} />
              <Stat
                label="Días sin consumo"
                value={m.weekFree && m.weekFree.tracked > 0 ? `${m.weekFree.free} de ${m.weekFree.tracked}` : '—'}
                hint={
                  m.weekFree === null || m.weekFree.tracked === 0
                    ? 'Se cuenta cuando termine un día registrado: hoy todavía no terminó.'
                    : m.weekFree.untracked > 0
                      ? `Días ya terminados. ${plural(m.weekFree.untracked, 'día', 'días')} sin datos no se cuentan.`
                      : 'Días ya terminados'
                }
              />
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <TrendLine c={m.comparison} />
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
