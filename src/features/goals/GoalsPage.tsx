import { useMemo, useState, type FormEvent } from 'react';
import { Pause, Pencil, Play, Plus, Save, Target, Trash2, X } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button, EmptyState, Field, PageHeader, Segmented } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { evaluateGoal, goalEndKey, togglePause } from '@/domain/goals';
import { SCHEMA_VERSION, personalGoal, type Currency, type GoalTarget, type GoalType, type PersonalGoal } from '@/domain/model';
import { minorToInput, parseMoneyInput } from '@/domain/money';
import { formatPeriod, t } from '@/i18n';
import { newId } from '@/utils/id';
import { GoalStatusBadge, describeTarget, progressRatio, progressText, supportiveMessage } from './goalView';

const TYPES = Object.keys(t.goalTypes) as GoalType[];

export function GoalsPage() {
  const { data, save } = useData();
  const today = useToday();
  const toast = useToast();
  const [editing, setEditing] = useState<PersonalGoal | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<PersonalGoal | null>(null);

  const goals = useMemo(
    () =>
      [...data.goals]
        .sort((a, b) => (a.status === b.status ? b.createdAt.localeCompare(a.createdAt) : a.status === 'active' ? -1 : 1))
        .map((g) => ({ g, ev: evaluateGoal(g, data, today) })),
    [data, today],
  );

  async function onTogglePause(g: PersonalGoal) {
    try {
      const next = togglePause(g, today, new Date().toISOString());
      await save('goals', next);
      toast(next.status === 'paused' ? 'Objetivo en pausa' : 'Objetivo reanudado');
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Objetivos"
        description="Opcionales y personales. Cada uno tiene su propia forma de medirse. No hay puntajes ni rankings."
        actions={
          editing === null && (
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing('new')}>
              Nuevo objetivo
            </Button>
          )
        }
      />

      {editing && (
        <div className="mb-5">
          <GoalForm key={editing === 'new' ? 'new' : editing.id} existing={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </div>
      )}

      {goals.length === 0 && !editing ? (
        <div className="card">
          <EmptyState
            icon={Target}
            title="Sin objetivos por ahora"
            action={
              <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                Crear un objetivo
              </Button>
            }
          >
            Podés proponerte reducir la frecuencia, limitar el gasto, sumar días sin consumo, hacer una pausa o simplemente observar tus
            hábitos unas semanas.
          </EmptyState>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {goals.map(({ g, ev }) => {
            const ratio = progressRatio(g, ev);
            const msg = supportiveMessage(g, ev);
            const end = goalEndKey(g);
            return (
              <li key={g.id} className="card flex flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="eyebrow">{t.goalTypes[g.target.type].title}</p>
                    <h2 className="mt-1 font-display text-lg font-semibold text-fg">{g.title}</h2>
                  </div>
                  <GoalStatusBadge status={ev.status} />
                </div>
                <p className="mt-1 text-sm text-fg-muted">{describeTarget(g)}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {end ? formatPeriod({ from: g.startDate, to: end }) : `Desde ${formatPeriod({ from: g.startDate, to: g.startDate })}, sin fecha de fin`}
                </p>
                {ratio !== null && ev.status !== 'not_started' && (
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                )}
                <p className="mt-2 text-sm text-fg">{progressText(g, ev)}</p>
                {msg && <p className="mt-2 text-sm text-fg-muted">{msg}</p>}
                {ev.periods.length > 1 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-fg-muted hover:text-fg">Historial por período</summary>
                    <ul className="mt-2 grid gap-1">
                      {[...ev.periods].reverse().map((p) => (
                        <li key={p.period.from} className="flex items-center justify-between gap-2 text-xs">
                          <span className="num text-fg-muted">{formatPeriod(p.window)}</span>
                          <GoalStatusBadge status={p.status} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Button size="sm" icon={g.status === 'active' ? Pause : Play} onClick={() => void onTogglePause(g)}>
                    {g.status === 'active' ? 'Pausar' : 'Reanudar'}
                  </Button>
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(g)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setToDelete(g)}>
                    Eliminar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <DeleteGoal goal={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

function defaultTarget(type: GoalType, currency: Currency): GoalTarget {
  switch (type) {
    case 'reduce_frequency':
      return { type, maxSessionsPerWeek: 3 };
    case 'spending_limit':
      return { type, period: 'week', limit: { amountMinor: 0, currency } };
    case 'free_days':
      return { type, minFreeDaysPerWeek: 2 };
    case 'pause':
      return { type };
    case 'daily_log':
      return { type, minLoggedDaysPerWeek: 5 };
    case 'observe':
      return { type, weeks: 4 };
  }
}

function GoalForm({ existing, onDone }: { existing?: PersonalGoal; onDone: () => void }) {
  const { data, save } = useData();
  const toast = useToast();
  const today = useToday();
  const currency = existing?.target.type === 'spending_limit' ? existing.target.limit.currency : data.preferences.currency;
  const [type, setType] = useState<GoalType>(existing?.target.type ?? 'reduce_frequency');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endDate, setEndDate] = useState(existing?.endDate ?? '');
  const initial = existing?.target ?? defaultTarget(type, currency);
  const [num, setNum] = useState(() => {
    switch (initial.type) {
      case 'reduce_frequency':
        return String(initial.maxSessionsPerWeek);
      case 'free_days':
        return String(initial.minFreeDaysPerWeek);
      case 'daily_log':
        return String(initial.minLoggedDaysPerWeek);
      case 'observe':
        return String(initial.weeks);
      default:
        return '';
    }
  });
  const [spendPeriod, setSpendPeriod] = useState<'week' | 'month'>(initial.type === 'spending_limit' ? initial.period : 'week');
  const [amount, setAmount] = useState(initial.type === 'spending_limit' && initial.limit.amountMinor > 0 ? minorToInput(initial.limit.amountMinor, currency) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function changeType(next: GoalType) {
    setType(next);
    const d = defaultTarget(next, currency);
    setNum(
      d.type === 'reduce_frequency'
        ? String(d.maxSessionsPerWeek)
        : d.type === 'free_days'
          ? String(d.minFreeDaysPerWeek)
          : d.type === 'daily_log'
            ? String(d.minLoggedDaysPerWeek)
            : d.type === 'observe'
              ? String(d.weeks)
              : '',
    );
    setErrors({});
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const n = Number(num);
    const int = (min: number, max: number, msg: string) => {
      if (!/^\d+$/.test(num) || n < min || n > max) errs.num = msg;
    };
    let target: GoalTarget | null = null;
    switch (type) {
      case 'reduce_frequency':
        int(0, 100, 'Ingresá un número entero entre 0 y 100');
        target = { type, maxSessionsPerWeek: n };
        break;
      case 'free_days':
        int(1, 7, 'Ingresá un número de días entre 1 y 7');
        target = { type, minFreeDaysPerWeek: n };
        break;
      case 'daily_log':
        int(1, 7, 'Ingresá un número de días entre 1 y 7');
        target = { type, minLoggedDaysPerWeek: n };
        break;
      case 'observe':
        int(1, 52, 'Ingresá entre 1 y 52 semanas');
        target = { type, weeks: n };
        break;
      case 'pause':
        target = { type };
        break;
      case 'spending_limit': {
        const r = parseMoneyInput(amount, currency);
        if (!r.ok) errs.amount = r.error;
        else if (r.amountMinor === 0) errs.amount = 'El límite debe ser mayor que cero';
        target = { type, period: spendPeriod, limit: { amountMinor: r.ok ? r.amountMinor : 0, currency } };
        break;
      }
    }
    if (type === 'pause' && !endDate) errs.endDate = 'Una pausa necesita fecha de fin';
    if (endDate && endDate < startDate) errs.endDate = 'La fecha de fin debe ser igual o posterior al inicio';
    if (Object.keys(errs).length || !target) {
      setErrors(errs);
      return;
    }
    const now = new Date().toISOString();
    const parsed = personalGoal.safeParse({
      id: existing?.id ?? newId(),
      schemaVersion: SCHEMA_VERSION,
      title: title.trim() || t.goalTypes[type].title,
      startDate,
      endDate: type === 'observe' ? null : endDate || null,
      status: existing?.status ?? 'active',
      pausedIntervals: existing?.pausedIntervals ?? [],
      target,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!parsed.success) {
      setErrors({ form: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await save('goals', parsed.data);
      toast(existing ? 'Objetivo actualizado' : 'Objetivo creado');
      onDone();
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  const numLabel: Partial<Record<GoalType, string>> = {
    reduce_frequency: 'Máximo de sesiones por semana',
    free_days: 'Días sin consumo por semana (mínimo)',
    daily_log: 'Días con registro por semana (mínimo)',
    observe: 'Duración en semanas',
  };

  return (
    <form onSubmit={onSubmit} noValidate className="card animate-rise grid gap-5 p-4 sm:p-6" aria-label={existing ? 'Editar objetivo' : 'Nuevo objetivo'}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{existing ? 'Editar objetivo' : 'Nuevo objetivo'}</h2>
        <Button size="sm" variant="ghost" icon={X} aria-label="Cerrar formulario" onClick={onDone} />
      </div>
      <fieldset className="min-w-0" disabled={Boolean(existing)}>
        <legend className="mb-1.5 text-sm font-medium text-fg">Tipo de objetivo{existing && <span className="font-normal text-fg-subtle"> (no se puede cambiar)</span>}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((ty) => (
            <label
              key={ty}
              className={
                'cursor-pointer rounded-[var(--radius-md)] border p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ' +
                (type === ty ? 'border-[rgb(182_243_106/0.5)] bg-accent-soft' : 'border-border-strong bg-surface-2 hover:border-[#4a505a]')
              }
            >
              <input type="radio" name="goal-type" className="sr-only" value={ty} checked={type === ty} onChange={() => changeType(ty)} />
              <span className="block text-sm font-medium text-fg">{t.goalTypes[ty].title}</span>
              <span className="mt-0.5 block text-xs text-fg-muted">{t.goalTypes[ty].hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" optional hint={`Si lo dejás vacío: «${t.goalTypes[type].title}»`}>
          {({ id, describedBy }) => (
            <input id={id} className="field-input" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} aria-describedby={describedBy} />
          )}
        </Field>
        {type in numLabel && (
          <Field label={numLabel[type]!} error={errors.num}>
            {({ id, describedBy, invalid }) => (
              <input id={id} inputMode="numeric" className="field-input num" value={num} onChange={(e) => setNum(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
        )}
        {type === 'spending_limit' && (
          <>
            <Field label={`Límite de gasto real (${currency})`} error={errors.amount}>
              {({ id, describedBy, invalid }) => (
                <input id={id} inputMode="decimal" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
              )}
            </Field>
            <Segmented
              legend="Período"
              value={spendPeriod}
              onChange={setSpendPeriod}
              options={[
                { value: 'week', label: 'Por semana' },
                { value: 'month', label: 'Por mes' },
              ]}
            />
          </>
        )}
        <Field label="Inicio" error={errors.startDate}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="date" className="field-input num" value={startDate} onChange={(e) => setStartDate(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        {type !== 'observe' && (
          <Field label="Fin" optional={type !== 'pause'} error={errors.endDate} hint={type === 'pause' ? undefined : 'Vacío = sin fecha de fin'}>
            {({ id, describedBy, invalid }) => (
              <input id={id} type="date" min={startDate} className="field-input num" value={endDate} onChange={(e) => setEndDate(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
        )}
      </div>
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" icon={Save} disabled={busy}>
          {existing ? 'Guardar cambios' : 'Crear objetivo'}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function DeleteGoal({ goal, onClose }: { goal: PersonalGoal | null; onClose: () => void }) {
  const { remove } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={goal !== null}
      title="¿Eliminar este objetivo?"
      confirmLabel="Eliminar objetivo"
      busy={busy}
      onCancel={onClose}
      onConfirm={async () => {
        if (!goal) return;
        setBusy(true);
        try {
          await remove('goals', goal.id);
          toast('Objetivo eliminado');
          onClose();
        } catch (err) {
          toast(storageErrorMessage(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      Se elimina el objetivo «{goal?.title}». Tus registros de consumo no cambian.
    </ConfirmDialog>
  );
}

