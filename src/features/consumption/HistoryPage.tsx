import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, History, Plus, Search, SearchX } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { Badge, Button, EmptyState, LinkButton, PageHeader } from '@/components/ui';
import { CONTEXTS, METHODS, type ConsumptionEntry, type Context, type Method } from '@/domain/model';
import { capitalize, formatDay, formatMoneyObj, formatQuantity, formatTime, plural, t } from '@/i18n';
import { addDaysKey, dayKeyOfIso, inPeriod, monthOf, type DayKey, type Period } from '@/utils/dates';
import { normalize } from '@/utils/text';

type PeriodFilter = 'all' | '7d' | '30d' | 'month' | 'prev_month';
const PAGE = 40;

function periodFor(f: PeriodFilter, today: DayKey): Period | null {
  switch (f) {
    case 'all':
      return null;
    case '7d':
      return { from: addDaysKey(today, -6), to: today };
    case '30d':
      return { from: addDaysKey(today, -29), to: today };
    case 'month':
      return monthOf(today);
    case 'prev_month':
      return monthOf(addDaysKey(monthOf(today).from, -1));
  }
}

export function EntrySummary({ e }: { e: ConsumptionEntry }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-medium text-fg">{t.methods[e.method]}</span>
      <span className="num text-sm text-fg-muted">{e.quantity ? formatQuantity(e.quantity) : 'sin cantidad'}</span>
      {e.strain && <Badge tone="accent">{e.strain}</Badge>}
      {e.context && <Badge>{t.contexts[e.context]}</Badge>}
      {e.cost && (
        <Badge tone={e.cost.kind === 'paid' ? 'cyan' : 'neutral'}>
          {formatMoneyObj(e.cost)}
          {e.cost.kind === 'estimated' ? ' est.' : ''}
        </Badge>
      )}
    </div>
  );
}

export function HistoryPage() {
  const { data } = useData();
  const today = useToday();
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [method, setMethod] = useState<Method | 'all'>('all');
  const [context, setContext] = useState<Context | 'none' | 'all'>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const p = periodFor(period, today);
    const q = normalize(query.trim());
    return data.consumption
      .filter((e) => (p ? inPeriod(dayKeyOfIso(e.occurredAt), p) : true))
      .filter((e) => method === 'all' || e.method === method)
      .filter((e) => context === 'all' || (context === 'none' ? e.context === null : e.context === context))
      .filter((e) => q === '' || normalize(e.notes).includes(q) || normalize(e.strain ?? '').includes(q))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [data.consumption, period, method, context, query, today]);

  const visible = filtered.slice(0, limit);
  const groups = useMemo(() => {
    const m = new Map<DayKey, ConsumptionEntry[]>();
    for (const e of visible) {
      const k = dayKeyOfIso(e.occurredAt);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [visible]);

  const hasFilters = period !== 'all' || method !== 'all' || context !== 'all' || query.trim() !== '';
  const resetFilters = () => {
    setPeriod('all');
    setMethod('all');
    setContext('all');
    setQuery('');
    setLimit(PAGE);
  };

  if (data.consumption.length === 0) {
    return (
      <>
        <PageHeader title="Historial" mood="sleepy" />
        <div className="card">
          <EmptyState
            icon={History}
            mood="sleepy"
            title="Todavía no hay humo registrado"
            action={
              <LinkButton to="/registrar" variant="primary" icon={Plus}>
                Registrar consumo
              </LinkButton>
            }
          >
            Cada sesión que registres aparecerá acá, ordenada por fecha. Podés editarla o eliminarla cuando quieras.
          </EmptyState>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Historial"
        mood="chill"
        description={`${plural(filtered.length, 'registro', 'registros')}${hasFilters ? ' con los filtros actuales' : ''}`}
        actions={
          <LinkButton to="/registrar" variant="primary" icon={Plus} size="sm">
            Registrar
          </LinkButton>
        }
      />

      <div className="card mb-5 grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4" role="search" aria-label="Filtrar historial">
        <label className="grid gap-1 text-xs text-fg-subtle">
          Período
          <select className="field-input text-sm" value={period} onChange={(e) => { setPeriod(e.target.value as PeriodFilter); setLimit(PAGE); }}>
            <option value="all">Todo</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="month">Este mes</option>
            <option value="prev_month">Mes anterior</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-fg-subtle">
          Formato
          <select className="field-input text-sm" value={method} onChange={(e) => { setMethod(e.target.value as Method | 'all'); setLimit(PAGE); }}>
            <option value="all">Todos</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t.methods[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-fg-subtle">
          Contexto
          <select className="field-input text-sm" value={context} onChange={(e) => { setContext(e.target.value as Context | 'none' | 'all'); setLimit(PAGE); }}>
            <option value="all">Todos</option>
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {t.contexts[c]}
              </option>
            ))}
            <option value="none">Sin contexto indicado</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-fg-subtle">
          Buscar en notas o variedad
          <span className="relative">
            <Search aria-hidden size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="search"
              className="field-input pl-9 text-sm"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
              placeholder="Palabra…"
            />
          </span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={SearchX} mood="curious" title="Sin resultados" compact action={<Button onClick={resetFilters}>Quitar filtros</Button>}>
            Ningún registro coincide con estos filtros.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map(([day, items]) => (
            <section key={day} aria-label={formatDay(day)}>
              <h2 className="eyebrow mb-2 flex items-center justify-between px-1">
                <span>{capitalize(formatDay(day, "EEEE d 'de' MMMM yyyy"))}</span>
                <span className="num normal-case tracking-normal">{plural(items.length, 'sesión', 'sesiones')}</span>
              </h2>
              <ul className="card divide-y divide-border overflow-hidden">
                {items.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/historial/${e.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                      aria-label={`${t.methods[e.method]} a las ${formatTime(e.occurredAt)}, ver detalle`}
                    >
                      <span className="num w-12 shrink-0 text-sm text-fg-subtle">{formatTime(e.occurredAt)}</span>
                      <div className="min-w-0 flex-1">
                        <EntrySummary e={e} />
                        {e.notes && <p className="mt-0.5 truncate text-xs text-fg-subtle">{e.notes}</p>}
                      </div>
                      <ChevronRight aria-hidden size={18} className="shrink-0 text-fg-subtle" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {filtered.length > limit && (
            <Button onClick={() => setLimit((l) => l + PAGE)} className="justify-self-center">
              Mostrar más ({filtered.length - limit} restantes)
            </Button>
          )}
        </div>
      )}
    </>
  );
}
