/**
 * Gráficos de patrones: velocímetro semanal, calendario de calor, dona de
 * formatos y gasto acumulado. Todos con alternativa textual accesible.
 */
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART } from './charts';
import { cx } from './ui';
import { addDaysKey, eachDayKey, parseDayKey, type DayKey } from '@/utils/dates';
import { capitalize, formatDay } from '@/i18n';

// ---------- Velocímetro ----------

const polar = (cx0: number, cy0: number, r: number, angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx0 + r * Math.cos(a), y: cy0 + r * Math.sin(a) };
};
/** Arco de -180° (izquierda) a 0° (derecha) según fracción 0–1. */
function arcPath(r: number, from: number, to: number) {
  const a0 = -180 + 180 * from;
  const a1 = -180 + 180 * to;
  const p0 = polar(100, 100, r, a0);
  const p1 = polar(100, 100, r, a1);
  return `M${p0.x} ${p0.y} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p1.x} ${p1.y}`;
}

export interface GaugeMarker {
  value: number;
  label: string;
  tone: 'cyan' | 'fg';
}

/**
 * Velocímetro de sesiones de la semana. La escala se adapta a los datos
 * (nunca menos de 7). Los marcadores muestran promedio y meta, con texto.
 */
export function WeekGauge({ value, markers, caption, children }: { value: number; markers: GaugeMarker[]; caption: string; children?: React.ReactNode }) {
  const max = Math.max(7, Math.ceil(Math.max(value, ...markers.map((m) => m.value)) * 1.25));
  const frac = Math.min(1, value / max);
  const needleAngle = -180 + 180 * frac;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((i) => max <= 14 || i % 2 === 0);
  return (
    <figure className="m-0" role="img" aria-label={caption}>
      <svg viewBox="0 0 200 120" className="w-full max-w-[22rem]">
        <path d={arcPath(80, 0, 1)} fill="none" stroke="#22262b" strokeWidth="16" strokeLinecap="round" />
        {frac > 0 && <path d={arcPath(80, 0, frac)} fill="none" stroke={CHART.series} strokeWidth="16" strokeLinecap="round" />}
        {ticks.map((i) => {
          const a = -180 + (180 * i) / max;
          const p0 = polar(100, 100, 94, a);
          const p1 = polar(100, 100, 98, a);
          return <line key={i} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="#3a3f46" strokeWidth="1.2" />;
        })}
        {markers.map((m) => {
          const a = -180 + 180 * Math.min(1, m.value / max);
          const p0 = polar(100, 100, 66, a);
          const p1 = polar(100, 100, 96, a);
          const color = m.tone === 'cyan' ? '#6fd6ec' : '#eceef1';
          return <line key={m.label} x1={p0.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth="2.5" strokeDasharray={m.tone === 'fg' ? '3 2' : undefined} strokeLinecap="round" />;
        })}
        {/* aguja con punta de hoja */}
        <g transform={`rotate(${needleAngle} 100 100)`}>
          <line x1="100" y1="100" x2="146" y2="100" stroke="#eceef1" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M144 100 C150 93 158 92 166 100 C158 108 150 107 144 100Z" fill={CHART.series} />
          <path d="M146 100 H163" stroke="#3b5520" strokeWidth="1" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="100" r="6" fill="#eceef1" />
        <text x="18" y="116" fill={CHART.axis} fontSize="9" textAnchor="middle">0</text>
        <text x="182" y="116" fill={CHART.axis} fontSize="9" textAnchor="middle">{max}</text>
      </svg>
      {children}
      {markers.length > 0 && (
        <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          {markers.map((m) => (
            <span key={m.label} className="inline-flex items-center gap-1.5">
              <span aria-hidden className={cx('inline-block h-0.5 w-4', m.tone === 'cyan' ? 'bg-cyan' : 'border-t-2 border-dashed border-fg')} />
              {m.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  );
}

// ---------- Calendario de calor ----------

const HEAT = ['#20242a', '#3b5520', '#6c9a33', '#b6f36a'] as const;
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Cuadrícula semanas × días (lunes arriba). Días sin datos: contorno punteado. */
export function CalendarHeatmap({
  from,
  to,
  counts,
  start,
  caption,
}: {
  from: DayKey;
  to: DayKey;
  counts: Map<DayKey, number>;
  start: DayKey | null;
  caption: string;
}) {
  const days = eachDayKey({ from, to });
  const firstMonday = addDaysKey(from, -((parseDayKey(from).getDay() + 6) % 7));
  const weeks: (DayKey | null)[][] = [];
  for (let w = firstMonday; w <= to; w = addDaysKey(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const d = addDaysKey(w, i);
      return d < from || d > to ? null : d;
    }));
  }
  const level = (n: number) => (n <= 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : 3);
  const cell = 13;
  const gap = 3;
  const left = 14;
  const top = 14;
  const width = left + weeks.length * (cell + gap);
  const height = top + 7 * (cell + gap);
  return (
    <figure className="m-0">
      <div className="overflow-x-auto pb-1">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width * 2.6, minWidth: 300 }} aria-hidden>
          {WEEKDAYS.map((l, i) =>
            i % 2 === 0 ? (
              <text key={i} x={0} y={top + i * (cell + gap) + 10} fill={CHART.axis} fontSize="8">
                {l}
              </text>
            ) : null,
          )}
          {weeks.map((wk, wi) => {
            const firstOfMonth = wk.find((d) => d?.endsWith('-01'));
            return (
              <g key={wi}>
                {(wi === 0 || firstOfMonth) && (
                  <text x={left + wi * (cell + gap)} y={9} fill={CHART.axis} fontSize="8">
                    {formatDay(firstOfMonth ?? wk.find(Boolean)!, 'MMM')}
                  </text>
                )}
                {wk.map((d, di) => {
                  if (!d) return null;
                  const x = left + wi * (cell + gap);
                  const y = top + di * (cell + gap);
                  const tracked = start !== null && d >= start;
                  const n = counts.get(d) ?? 0;
                  return tracked ? (
                    <rect key={d} x={x} y={y} width={cell} height={cell} rx={3} fill={HEAT[level(n)]}>
                      <title>{`${capitalize(formatDay(d))}: ${n === 0 ? 'sin humo' : `${n} ${n === 1 ? 'sesión' : 'sesiones'}`}`}</title>
                    </rect>
                  ) : (
                    <rect key={d} x={x + 0.5} y={y + 0.5} width={cell - 1} height={cell - 1} rx={3} fill="none" stroke="#2f343b" strokeDasharray="2 2">
                      <title>{`${capitalize(formatDay(d))}: sin datos`}</title>
                    </rect>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          Menos
          {HEAT.map((c) => (
            <span key={c} aria-hidden className="inline-block size-3 rounded-[3px]" style={{ background: c }} />
          ))}
          Más
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="inline-block size-3 rounded-[3px] border border-dashed border-border-strong" /> Sin datos
        </span>
      </figcaption>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {days.map((d) => (
              <tr key={d}>
                <th scope="row">{formatDay(d)}</th>
                <td>{start === null || d < start ? 'sin datos' : `${counts.get(d) ?? 0} sesiones`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

// ---------- Dona de formatos ----------

/** Paleta categórica validada (contraste, daltonismo) sobre la superficie oscura. */
export const CATEGORICAL = ['#6aa832', '#2f9ab3', '#c8742a', '#9070d6'] as const;
export const OTHER = '#5c636c';

export function Donut({ slices, caption, centerLabel }: { slices: { key: string; label: string; value: number }[]; caption: string; centerLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const color = (i: number, key: string) => (key === 'others' ? OTHER : CATEGORICAL[i % CATEGORICAL.length]!);
  return (
    <figure className="m-0 grid items-center gap-4 sm:grid-cols-[10rem_1fr]">
      <div className="relative mx-auto size-40" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="100%" stroke={CHART.surface} strokeWidth={2} isAnimationActive={false} startAngle={90} endAngle={-270}>
              {slices.map((s, i) => (
                <Cell key={s.key} fill={color(i, s.key)} />
              ))}
            </Pie>
            <Tooltip
              isAnimationActive={false}
              content={(p: { active?: boolean; payload?: readonly { name?: unknown; value?: unknown }[] }) => {
                const it = p.active ? p.payload?.[0] : undefined;
                if (!it) return null;
                return (
                  <div className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs">
                    {String(it.name)}: <strong className="num">{String(it.value)}</strong>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-2xl font-semibold text-fg">{total}</div>
            <div className="text-[0.7rem] text-fg-subtle">{centerLabel}</div>
          </div>
        </div>
      </div>
      <figcaption>
        <span className="sr-only">{caption}</span>
        <ul className="grid gap-1.5">
          {slices.map((s, i) => (
            <li key={s.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-fg">
                <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: color(i, s.key) }} />
                {s.label}
              </span>
              <span className="num text-fg-muted">
                {s.value} · {total ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

// ---------- Gasto acumulado ----------

export function CumulativeArea({
  points,
  budget,
  format,
  caption,
}: {
  points: { label: string; fullLabel: string; value: number }[];
  budget: number | null;
  format: (v: number) => string;
  caption: string;
}) {
  const max = Math.max(budget ?? 0, ...points.map((p) => p.value)) * 1.1 || 1;
  return (
    <figure className="m-0">
      <div aria-hidden style={{ height: 190 }} className="-mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: -6 }}>
            <defs>
              <linearGradient id="cum-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={CHART.series} stopOpacity={0.28} />
                <stop offset="1" stopColor={CHART.series} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={58} domain={[0, max]} tickFormatter={(v: number) => format(v)} />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              content={(p: { active?: boolean; payload?: readonly { payload?: { fullLabel: string; value: number } }[] }) => {
                const it = p.active ? p.payload?.[0]?.payload : undefined;
                if (!it) return null;
                return (
                  <div className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs">
                    <div className="text-fg-subtle">{it.fullLabel}</div>
                    <div className="num font-semibold text-fg">{format(it.value)} acumulado</div>
                  </div>
                );
              }}
            />
            {budget !== null && (
              <ReferenceLine y={budget} stroke="#eceef1" strokeDasharray="4 3" label={{ value: `Presupuesto ${format(budget)}`, position: 'insideTopLeft', fill: '#a7adb5', fontSize: 11 }} />
            )}
            <Area type="monotone" dataKey="value" stroke={CHART.series} strokeWidth={2} fill="url(#cum-fill)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {points.map((p) => (
              <tr key={p.fullLabel}>
                <th scope="row">{p.fullLabel}</th>
                <td>{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

