import { useMemo, useState } from 'react';
import { ChartColumn, Plus } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { Card, EmptyState, LinkButton, PageHeader, Segmented, Stat } from '@/components/ui';
import { BarSeries, DistributionList, LineSeries } from '@/components/charts';
import {
  MIN_ASSOCIATION_DAYS,
  averagePerDay,
  checkinAssociation,
  comparePeriods,
  contextDistribution,
  dailyCheckinSeries,
  dailyCounts,
  dailyQuantity,
  dailySpending,
  entriesInPeriod,
  estimatedUsage,
  freeDays,
  quantityTotals,
  realSpending,
  trackingStart,
  weeklyCounts,
  hourDistribution,
  methodDistribution,
  peakHour,
  sessionsByDay,
  weekdayAverages,
  type CheckinMetric,
} from '@/domain/analytics';
import { complianceRate, evaluateGoal } from '@/domain/goals';
import { otherCurrencies, totalIn } from '@/domain/money';
import { UNITS, type Unit } from '@/domain/model';
import { unitsPresent } from '@/domain/quantity';
import { capitalize, formatDay, formatMoney, formatNumber, formatPeriod, formatShortDay, formatTotals, plural, t } from '@/i18n';
import { comparedRange, type RangePreset } from '@/utils/dates';
import { TrendLine } from './Trend';
import { CalendarHeatmap, Donut } from '@/components/patternCharts';
import { Humito } from '@/components/brand';
import { addDaysKey } from '@/utils/dates';
import { GoalStatusBadge } from '@/features/goals/goalView';

const RANGES: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
  { value: 'month', label: 'Este mes' },
];

const METRIC_LABEL: Record<CheckinMetric, string> = {
  mood: 'Ánimo',
  stress: 'Estrés',
  sleep: 'Sueño',
  craving: 'Deseo de consumir',
};

export function StatsPage() {
  const { data } = useData();
  const today = useToday();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [unitChoice, setUnitChoice] = useState<Unit | null>(null);
  const [metric, setMetric] = useState<CheckinMetric>('mood');
  const cur = data.preferences.currency;

  const s = useMemo(() => {
    const range = comparedRange(preset, today);
    const start = trackingStart(data.consumption, data.checkins, data.expenses);
    const inRange = entriesInPeriod(data.consumption, range.current);
    return {
      range,
      start,
      inRange,
      comparison: comparePeriods(data.consumption, range, start),
      daily: dailyCounts(data.consumption, range.current, start),
      weekly: weeklyCounts(data.consumption, range.current, start),
      free: freeDays(data.consumption, range.current, start),
      qty: quantityTotals(inRange),
      units: unitsPresent(inRange.map((e) => e.quantity)),
      contexts: contextDistribution(inRange),
      spend: realSpending(data.expenses, data.consumption, range.current),
      spendPrev: realSpending(data.expenses, data.consumption, range.previous),
      estimated: estimatedUsage(data.consumption, range.current),
      spendDaily: dailySpending(data.expenses, data.consumption, range.current, cur),
      goals: data.goals.map((g) => ({ g, ev: evaluateGoal(g, data, today) })),
      hours: hourDistribution(inRange),
      weekdays: weekdayAverages(data.consumption, range.current, start),
      methods: methodDistribution(inRange),
      heat: sessionsByDay(data.consumption),
    };
  }, [data, preset, today, cur]);

  const unit = unitChoice && s.units.includes(unitChoice) ? unitChoice : (s.units[0] ?? null);
  const qtySeries = useMemo(() => (unit ? dailyQuantity(s.inRange, s.range.current, unit) : []), [s, unit]);
  const assoc = useMemo(() => checkinAssociation(data.consumption, data.checkins, metric, s.range.current), [data, metric, s.range]);
  const checkinSeries = useMemo(() => dailyCheckinSeries(data.checkins, s.range.current), [data.checkins, s.range]);
  const hasCheckinData = checkinSeries.some((d) => d[metric] !== null);

  if (data.consumption.length === 0 && data.checkins.length === 0 && data.expenses.length === 0) {
    return (
      <>
        <PageHeader title="El humo en números" />
        <div className="card">
          <EmptyState
            icon={ChartColumn}
            title="Aún no hay datos para analizar"
            action={
              <LinkButton to="/registrar" variant="primary" icon={Plus}>
                Registrar consumo
              </LinkButton>
            }
          >
            Las estadísticas se calculan solo con tus registros. No mostramos tendencias inventadas.
          </EmptyState>
        </div>
      </>
    );
  }

  const longRange = s.daily.length > 31;
  const dayPoints = s.daily.map((d) => ({
    label: longRange ? formatShortDay(d.day) : formatDay(d.day, 'd'),
    fullLabel: capitalize(formatDay(d.day, "EEEE d 'de' MMMM")),
    value: d.count,
    muted: !d.tracked,
  }));
  const spendPrevTotal = totalIn(s.spendPrev, cur);
  const spendTotal = totalIn(s.spend, cur);
  const spendComparable = s.comparison.previousComparable;

  return (
    <>
      <PageHeader title="El humo en números" description={`Período analizado: ${formatPeriod(s.range.current)}`} />
      <div className="mb-5">
        <Segmented legend="Rango temporal" hideLegend value={preset} onChange={setPreset} options={RANGES} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Frecuencia" className="lg:col-span-2">
          <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Sesiones" value={s.comparison.current} />
            <Stat
              label="Promedio por día"
              value={s.free.tracked > 0 ? formatNumber(averagePerDay(s.comparison.current, s.free.tracked), 1) : '—'}
              hint={s.free.untracked > 0 ? 'Solo días con datos' : undefined}
            />
            <Stat
              label="Días sin humo"
              value={`${s.free.free} de ${s.free.tracked}`}
              hint={s.free.untracked > 0 ? `${s.free.untracked} días sin datos excluidos` : 'Días registrados'}
            />
            <Stat label="Días con consumo" value={s.free.tracked - s.free.free} />
          </div>
          <div className="mb-4 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2.5">
            <p className="eyebrow mb-1">
              Comparación: {formatPeriod(s.range.current)} vs. {formatPeriod(s.range.previous)}
            </p>
            <TrendLine c={s.comparison} />
          </div>
          <h3 className="mb-2 text-xs font-medium text-fg-subtle">Sesiones por día</h3>
          <BarSeries points={dayPoints} caption="Sesiones por día" valueHeader="Sesiones" format={(v) => formatNumber(v, 0)} />
        </Card>

        <Card title="Calendario de humo (últimas 12 semanas)" className="lg:col-span-2">
          <CalendarHeatmap
            from={addDaysKey(today, -83)}
            to={today}
            counts={s.heat}
            start={s.start}
            caption="Sesiones por día en las últimas 12 semanas"
          />
        </Card>

        <Card title="¿A qué hora prendés?">
          {s.inRange.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin sesiones en este período.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-fg">
                Tu hora pico: <strong className="num">{peakHour(s.hours)}–{(peakHour(s.hours)! + 1) % 24} h</strong>
              </p>
              <BarSeries
                height={150}
                caption="Sesiones por hora del día"
                valueHeader="Sesiones"
                format={(v) => formatNumber(v, 0)}
                points={s.hours.map((v, h) => ({ label: h % 3 === 0 ? `${h}h` : '', fullLabel: `${h}:00 a ${h}:59`, value: v }))}
              />
            </>
          )}
        </Card>

        <Card title="Tu semana tipo">
          {s.weekdays.every((d) => d.average === null) ? (
            <p className="text-sm text-fg-muted">Sin días con datos en este período.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-fg-muted">Promedio de sesiones por día de la semana (solo días con datos).</p>
              <BarSeries
                height={150}
                integer={false}
                caption="Promedio de sesiones por día de la semana"
                valueHeader="Promedio de sesiones"
                format={(v) => formatNumber(v, 1)}
                points={s.weekdays.map((d) => ({
                  label: ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'][d.weekday]!,
                  fullLabel: `${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][d.weekday]} (${d.days} días con datos)`,
                  value: d.average ?? 0,
                  muted: d.average === null,
                }))}
              />
            </>
          )}
        </Card>

        <Card title="Cómo lo consumís">
          {s.methods.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin sesiones en este período.</p>
          ) : (
            <Donut
              caption="Sesiones por formato de consumo"
              centerLabel="sesiones"
              slices={s.methods.map((m) => ({ key: m.method, label: m.method === 'others' ? 'Otros' : t.methods[m.method], value: m.count }))}
            />
          )}
        </Card>

        <Card title="Sesiones por semana">
          {s.weekly.length < 2 ? (
            <p className="text-sm text-fg-muted">Elegí un rango más largo para ver la evolución semanal.</p>
          ) : (
            <>
              <BarSeries
                height={170}
                caption="Sesiones por semana (lunes a domingo)"
                valueHeader="Sesiones"
                format={(v) => formatNumber(v, 0)}
                points={s.weekly.map((w) => ({
                  label: formatShortDay(w.week.from),
                  fullLabel: `Semana ${formatPeriod(w.week)}${w.trackedDays < 7 ? ` (${w.trackedDays} días con datos en el rango)` : ''}`,
                  value: w.count,
                  muted: w.trackedDays === 0,
                }))}
              />
              <p className="mt-2 text-xs text-fg-subtle">Las semanas de los extremos pueden estar incompletas dentro del rango.</p>
            </>
          )}
        </Card>

        <Card title="Contexto de las sesiones">
          {s.contexts.length === 0 ? (
            <p className="text-sm text-fg-muted">Sin sesiones en este período.</p>
          ) : (
            <DistributionList
              total={s.inRange.length}
              items={s.contexts.map((c) => ({
                key: c.context ?? 'none',
                label: c.context ? t.contexts[c.context] : 'Sin contexto indicado',
                count: c.count,
                muted: c.context === null,
              }))}
            />
          )}
        </Card>

        <Card title="Cantidades por unidad">
          {s.units.length === 0 ? (
            <p className="text-sm text-fg-muted">
              {s.inRange.length > 0 ? 'Las sesiones de este período no tienen cantidad registrada.' : 'Sin sesiones en este período.'}
            </p>
          ) : (
            <>
              <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
                {UNITS.filter((u) => s.qty.totals[u] !== undefined).map((u) => (
                  <li key={u} className="num text-sm">
                    <span className="text-lg font-semibold text-fg">{formatNumber(s.qty.totals[u]!, 3)}</span>{' '}
                    <span className="text-fg-muted">{t.units[u].many}</span>
                  </li>
                ))}
              </ul>
              {s.qty.withoutQuantity > 0 && (
                <p className="mb-3 text-xs text-fg-subtle">
                  {plural(s.qty.withoutQuantity, 'sesión', 'sesiones')} sin cantidad (no se cuentan como cero).
                </p>
              )}
              {s.units.length > 1 && (
                <div className="mb-3">
                  <Segmented
                    legend="Unidad del gráfico"
                    size="sm"
                    value={unit}
                    onChange={setUnitChoice}
                    options={s.units.map((u) => ({ value: u, label: t.units[u].short }))}
                  />
                </div>
              )}
              {unit && (
                <BarSeries
                  height={160}
                  integer={false}
                  caption={`Cantidad diaria en ${t.units[unit].many}`}
                  valueHeader={t.units[unit].many}
                  format={(v) => formatNumber(v, 2)}
                  points={qtySeries.map((d, i) => ({
                    label: dayPoints[i]?.label ?? '',
                    fullLabel: dayPoints[i]?.fullLabel ?? d.day,
                    value: d.value,
                    muted: dayPoints[i]?.muted,
                  }))}
                />
              )}
              <p className="mt-2 text-xs text-fg-subtle">Cada unidad se suma por separado: no hay conversiones entre unidades.</p>
            </>
          )}
        </Card>

        <Card title="Gasto real">
          <div className="mb-3 grid grid-cols-2 gap-4">
            <Stat label="En el período" value={formatMoney(spendTotal, cur)} />
            <Stat
              label="Período anterior"
              value={spendComparable ? formatMoney(spendPrevTotal, cur) : '—'}
              hint={spendComparable ? formatPeriod(s.range.previous) : 'Sin datos suficientes'}
            />
          </div>
          {otherCurrencies(s.spend, cur).length > 0 && (
            <p className="mb-2 text-xs text-fg-subtle">Otras monedas (sin convertir): {formatTotals(s.spend, cur)}</p>
          )}
          {totalIn(s.estimated, cur) > 0 && (
            <p className="mb-2 text-xs text-fg-subtle">
              Valor estimado de lo usado: {formatMoney(totalIn(s.estimated, cur), cur)}. Es una estimación y no se suma al gasto real.
            </p>
          )}
          <BarSeries
            height={150}
            integer={cur === 'CLP'}
            caption={`Gasto real por día en ${cur}`}
            valueHeader={`Gasto (${cur})`}
            format={(v) => formatMoney(v, cur)}
            points={s.spendDaily.map((d, i) => ({
              label: dayPoints[i]?.label ?? '',
              fullLabel: dayPoints[i]?.fullLabel ?? d.day,
              value: d.amountMinor,
              muted: dayPoints[i]?.muted,
            }))}
          />
        </Card>

        <Card title="Registro personal y consumo" className="lg:col-span-2">
          <div className="mb-3">
            <Segmented
              legend="Métrica"
              size="sm"
              value={metric}
              onChange={setMetric}
              options={(Object.keys(METRIC_LABEL) as CheckinMetric[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
            />
          </div>
          {!hasCheckinData ? (
            <p className="text-sm text-fg-muted">
              No hay datos de {METRIC_LABEL[metric].toLowerCase()} en este período. Podés anotarlos en{' '}
              <LinkButton to="/diario" variant="ghost" size="sm" className="!min-h-0 !px-1 underline">
                Registro personal
              </LinkButton>
              .
            </p>
          ) : (
            <>
              <LineSeries
                height={160}
                domain={metric === 'craving' ? [0, 4] : [1, 5]}
                caption={`${METRIC_LABEL[metric]}: promedio diario`}
                valueHeader={METRIC_LABEL[metric]}
                format={(v) => formatNumber(v, 1)}
                points={checkinSeries.map((d, i) => ({
                  label: dayPoints[i]?.label ?? '',
                  fullLabel: dayPoints[i]?.fullLabel ?? d.day,
                  value: d[metric],
                }))}
              />
              <div className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-3 text-sm">
                {assoc.sufficient ? (
                  <p className="text-fg">
                    En tus registros, el {METRIC_LABEL[metric].toLowerCase()} promedio fue{' '}
                    <strong className="num">{formatNumber(assoc.withConsumption.average ?? 0, 1)}</strong> los días con consumo (
                    {assoc.withConsumption.days} días) y <strong className="num">{formatNumber(assoc.withoutConsumption.average ?? 0, 1)}</strong>{' '}
                    los días sin consumo registrado ({assoc.withoutConsumption.days} días).
                    <span className="mt-1 block text-xs text-fg-subtle">
                      Esto describe una asociación en tus datos, no una causa. Otros factores pueden influir en ambos.
                    </span>
                  </p>
                ) : (
                  <p className="text-fg-muted">
                    Para comparar días con y sin consumo hacen falta al menos {MIN_ASSOCIATION_DAYS} días con dato en cada grupo. Hoy hay{' '}
                    {assoc.withConsumption.days} con consumo y {assoc.withoutConsumption.days} sin consumo. No sacamos conclusiones con
                    menos datos.
                  </p>
                )}
              </div>
            </>
          )}
        </Card>

        {s.goals.length > 0 && (
          <Card title="Cumplimiento de objetivos" className="lg:col-span-2">
            <ul className="divide-y divide-border">
              {s.goals.map(({ g, ev }) => {
                const rate = complianceRate(ev);
                return (
                  <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{g.title}</p>
                      <p className="text-xs text-fg-muted">
                        {ev.periods.length > 0
                          ? rate.closed > 0
                            ? `${rate.met} de ${plural(rate.closed, 'período cerrado', 'períodos cerrados')} cumplidos`
                            : 'Todavía no hay períodos cerrados'
                          : 'Objetivo de período único'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span aria-hidden className="flex items-center gap-1">
                      {ev.periods.slice(-8).map((p) => (
                        <span
                          key={p.period.from}
                          title={`${formatPeriod(p.period)}: ${t.goalStatus[p.status]}`}
                          className={
                            'size-3 rounded-[3px] border ' +
                            (p.status === 'met'
                              ? 'border-accent bg-accent'
                              : p.status === 'in_progress'
                                ? 'border-cyan bg-transparent'
                                : p.status === 'paused'
                                  ? 'border-border-strong bg-transparent'
                                  : 'border-border-strong bg-surface-3')
                          }
                        />
                      ))}
                      </span>
                      <span className="ml-2">
                        <GoalStatusBadge status={ev.status} />
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
      <div className="mt-8 flex items-center gap-3 text-xs text-fg-subtle">
        <Humito mood="curious" className="w-12 shrink-0" float={false} />
        <p>
          Días y semanas se calculan en la zona horaria de este dispositivo (semanas de lunes a domingo). Los días anteriores a tu
        primer registro se tratan como «sin datos».
        </p>
      </div>
    </>
  );
}
