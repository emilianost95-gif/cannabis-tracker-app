/**
 * Gráficos de una sola serie (sin leyenda: el título nombra la serie).
 * Marcas finas, ejes y grilla recesivos, tooltip al pasar el cursor y una
 * tabla equivalente para lectores de pantalla.
 */
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReactNode } from 'react';

export const CHART = {
  series: '#b6f36a',
  seriesMuted: '#3a4a2a',
  line: '#6fd6ec',
  grid: '#22262b',
  axis: '#858c95',
  surface: '#121417',
};

export interface Point {
  /** Etiqueta corta del eje X. */
  label: string;
  /** Etiqueta completa para tooltip y tabla. */
  fullLabel: string;
  value: number | null;
  /** Dato desconocido (antes de empezar a registrar): se dibuja apagado. */
  muted?: boolean;
}

function SrTable({ caption, points, format, valueHeader }: { caption: string; points: Point[]; format: (v: number) => string; valueHeader: string }) {
  return (
    // sr-only va en un contenedor: aplicado a <table> no limita su ancho y provoca desborde horizontal.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">{valueHeader}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.fullLabel}>
            <th scope="row">{p.fullLabel}</th>
            <td>{p.muted ? 'sin datos' : p.value === null ? 'sin dato' : format(p.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

function TooltipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-border-strong bg-surface-3 px-2.5 py-1.5 text-xs shadow-[var(--shadow-pop)]">
      <div className="text-fg-subtle">{title}</div>
      <div className="num mt-0.5 font-semibold text-fg">{children}</div>
    </div>
  );
}

type TooltipRenderProps = { active?: boolean; payload?: readonly { payload?: Point }[] };

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function BarSeries({
  points,
  caption,
  valueHeader,
  format,
  height = 180,
  integer = true,
}: {
  points: Point[];
  caption: string;
  valueHeader: string;
  format: (v: number) => string;
  height?: number;
  integer?: boolean;
}) {
  const interval = points.length > 31 ? Math.ceil(points.length / 10) - 1 : points.length > 14 ? 2 : 0;
  return (
    <figure className="m-0">
      <div aria-hidden style={{ height }} className="-mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barCategoryGap={points.length > 40 ? 1 : 2}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval={interval} minTickGap={4} />
            <YAxis {...axisProps} allowDecimals={!integer} width={44} tickFormatter={(v: number) => format(v)} />
            <Tooltip
              cursor={{ fill: 'rgb(255 255 255 / 0.04)' }}
              isAnimationActive={false}
              content={(props: TooltipRenderProps) => {
                const p = props.active ? props.payload?.[0]?.payload : undefined;
                if (!p) return null;
                return <TooltipBox title={p.fullLabel}>{p.muted ? 'Sin datos (antes de empezar a registrar)' : format(p.value ?? 0)}</TooltipBox>;
              }}
            />
            <Bar
              dataKey="value"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              shape={(props: unknown) => {
                const { x, y, width, height: h, payload } = props as { x: number; y: number; width: number; height: number; payload: Point };
                if (!h || h <= 0) return <g />;
                const r = Math.min(4, width / 2, h);
                const fill = payload.muted ? CHART.seriesMuted : CHART.series;
                return (
                  <path
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h} Z`}
                    fill={fill}
                  />
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={caption} points={points} format={format} valueHeader={valueHeader} />
    </figure>
  );
}

export function LineSeries({
  points,
  caption,
  valueHeader,
  format,
  height = 180,
  domain,
}: {
  points: Point[];
  caption: string;
  valueHeader: string;
  format: (v: number) => string;
  height?: number;
  domain?: [number, number];
}) {
  const interval = points.length > 31 ? Math.ceil(points.length / 10) - 1 : points.length > 14 ? 2 : 0;
  return (
    <figure className="m-0">
      <div aria-hidden style={{ height }} className="-mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis dataKey="label" {...axisProps} interval={interval} minTickGap={4} />
            <YAxis {...axisProps} width={44} domain={domain ?? ['auto', 'auto']} allowDecimals tickFormatter={(v: number) => format(v)} />
            <Tooltip
              cursor={{ stroke: CHART.axis, strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={(props: TooltipRenderProps) => {
                const p = props.active ? props.payload?.[0]?.payload : undefined;
                if (!p) return null;
                return <TooltipBox title={p.fullLabel}>{p.value === null ? 'Sin dato' : format(p.value)}</TooltipBox>;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART.line}
              strokeWidth={2}
              connectNulls
              isAnimationActive={false}
              dot={{ r: 3, fill: CHART.line, stroke: CHART.surface, strokeWidth: 2 }}
              activeDot={{ r: 5, fill: CHART.line, stroke: CHART.surface, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SrTable caption={caption} points={points} format={format} valueHeader={valueHeader} />
    </figure>
  );
}

/** Barra horizontal simple para distribuciones (etiqueta, valor y proporción en texto). */
export function DistributionList({ items, total }: { items: { key: string; label: string; count: number; muted?: boolean }[]; total: number }) {
  return (
    <ul className="grid gap-2.5">
      {items.map((i) => {
        const pct = total > 0 ? Math.round((i.count / total) * 100) : 0;
        return (
          <li key={i.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={i.muted ? 'text-fg-subtle' : 'text-fg'}>{i.label}</span>
              <span className="num text-fg-muted">
                {i.count} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: i.muted ? CHART.axis : CHART.series }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
