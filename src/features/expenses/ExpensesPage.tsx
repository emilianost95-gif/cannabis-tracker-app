import { useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Receipt, Save, Trash2, Wallet, X } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Button, Card, EmptyState, Field, PageHeader, Stat, cx } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { BarSeries } from '@/components/charts';
import { budgetStatus, realSpending, estimatedUsage, weeklySpending, type BudgetStatus } from '@/domain/analytics';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  SCHEMA_VERSION,
  UNITS,
  expenseEntry,
  type Currency,
  type ExpenseCategory,
  type ExpenseEntry,
  type Money,
  type Unit,
} from '@/domain/model';
import { minorToInput, otherCurrencies, parseMoneyInput, totalIn } from '@/domain/money';
import { parseQuantityInput } from '@/domain/quantity';
import { formatMoney, formatMoneyObj, formatPeriod, formatQuantity, formatShortDay, formatTotals, t } from '@/i18n';
import { addDaysKey, monthOf, weekOf, type Period } from '@/utils/dates';
import { newId } from '@/utils/id';

export function ExpensesPage() {
  const { data } = useData();
  const today = useToday();
  const cur = data.preferences.currency;
  const [editing, setEditing] = useState<ExpenseEntry | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<ExpenseEntry | null>(null);

  const s = useMemo(() => {
    const week = weekOf(today);
    const month = monthOf(today);
    const prevMonth = monthOf(addDaysKey(month.from, -1));
    const prevWeek = weekOf(addDaysKey(week.from, -1));
    const last8: Period = { from: addDaysKey(week.from, -49), to: week.to > today ? today : week.to };
    return {
      week,
      month,
      prevMonth,
      prevWeek,
      today: realSpending(data.expenses, data.consumption, { from: today, to: today }),
      weekSpend: realSpending(data.expenses, data.consumption, { from: week.from, to: today }),
      prevWeekSpend: realSpending(data.expenses, data.consumption, prevWeek),
      monthSpend: realSpending(data.expenses, data.consumption, { from: month.from, to: today }),
      prevMonthSpend: realSpending(data.expenses, data.consumption, prevMonth),
      monthEstimated: estimatedUsage(data.consumption, { from: month.from, to: today }),
      weekly: weeklySpending(data.expenses, data.consumption, last8, cur),
    };
  }, [data, today, cur]);

  const sorted = [...data.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const paidSessions = data.consumption.filter((e) => e.cost?.kind === 'paid').length;
  const budgets = data.preferences.budgets;

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Gasto real = compras registradas acá + importes marcados como «pagué en el momento» al registrar una sesión. Los valores estimados se muestran aparte."
        actions={
          <Button variant="primary" size="sm" icon={Plus} onClick={() => setEditing('new')}>
            Agregar gasto
          </Button>
        }
      />

      {editing && (
        <div className="mb-5">
          <ExpenseForm
            key={editing === 'new' ? 'new' : editing.id}
            existing={editing === 'new' ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Resumen" icon={Wallet} className="lg:col-span-3">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Hoy" value={formatMoney(totalIn(s.today, cur), cur)} />
            <Stat
              label="Esta semana"
              value={formatMoney(totalIn(s.weekSpend, cur), cur)}
              hint={`Semana anterior: ${formatMoney(totalIn(s.prevWeekSpend, cur), cur)}`}
            />
            <Stat
              label="Este mes"
              value={formatMoney(totalIn(s.monthSpend, cur), cur)}
              hint={`${formatPeriod(s.prevMonth)}: ${formatMoney(totalIn(s.prevMonthSpend, cur), cur)}`}
            />
            <Stat
              label="Valor estimado usado (mes)"
              value={formatMoney(totalIn(s.monthEstimated, cur), cur)}
              hint="Estimación, no es gasto adicional"
            />
          </div>
          {[s.weekSpend, s.monthSpend].some((x) => otherCurrencies(x, cur).length > 0) && (
            <p className="mt-3 text-xs text-fg-subtle">
              Hay gastos en otras monedas que no se convierten ni se suman: este mes {formatTotals(s.monthSpend, cur)}.
            </p>
          )}
        </Card>

        <Card title="Presupuesto" className="lg:col-span-1">
          <div className="grid gap-4">
            <BudgetRow label="Semanal" budget={budgets.weekly} spent={totalIn(s.weekSpend, cur)} currency={cur} />
            <BudgetRow label="Mensual" budget={budgets.monthly} spent={totalIn(s.monthSpend, cur)} currency={cur} />
          </div>
          <BudgetForm />
        </Card>

        <Card title="Gasto real por semana (últimas 8)" className="lg:col-span-2">
          <BarSeries
            height={190}
            integer={cur === 'CLP'}
            caption={`Gasto real por semana en ${cur}`}
            valueHeader={`Gasto (${cur})`}
            format={(v) => formatMoney(v, cur)}
            points={s.weekly.map((w) => ({
              label: formatShortDay(w.week.from),
              fullLabel: `Semana ${formatPeriod(w.week)}`,
              value: w.amountMinor,
            }))}
          />
        </Card>

        <Card title="Compras registradas" icon={Receipt} className="lg:col-span-3">
          {sorted.length === 0 ? (
            <EmptyState
              compact
              icon={Receipt}
              title="Sin compras registradas"
              action={
                <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                  Agregar gasto
                </Button>
              }
            >
              Registrá tus compras para conocer tu gasto real. {paidSessions > 0 && `Ya tenés ${paidSessions} sesiones con importe pagado.`}
            </EmptyState>
          ) : (
            <ul className="-mx-1 divide-y divide-border">
              {sorted.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-1 py-2.5">
                  <span className="num w-16 shrink-0 text-sm text-fg-subtle">{formatShortDay(x.date)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg">
                      <span className="num font-semibold">{formatMoneyObj(x.amount)}</span>{' '}
                      <span className="text-fg-muted">· {t.expenseCategories[x.category]}</span>
                      {x.quantity && <span className="num text-fg-muted"> · {formatQuantity(x.quantity)}</span>}
                    </p>
                    {x.notes && <p className="truncate text-xs text-fg-subtle">{x.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label={`Editar gasto del ${formatShortDay(x.date)}`} onClick={() => setEditing(x)} />
                  <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Eliminar gasto del ${formatShortDay(x.date)}`} onClick={() => setToDelete(x)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <DeleteExpense expense={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

function BudgetRow({ label, budget, spent, currency }: { label: string; budget: Money | null; spent: number; currency: Currency }) {
  if (!budget) return <Stat label={`Presupuesto ${label.toLowerCase()}`} value="Sin definir" />;
  if (budget.currency !== currency) {
    return <Stat label={`Presupuesto ${label.toLowerCase()}`} value={formatMoneyObj(budget)} hint="Está en otra moneda que tu moneda preferida: no se compara." />;
  }
  const b: BudgetStatus = budgetStatus(budget.amountMinor, spent);
  const over = b.remainingMinor < 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-fg-subtle">{label}</span>
        <span className="num text-fg">
          {formatMoney(spent, currency)} / {formatMoney(budget.amountMinor, currency)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className={cx('h-full rounded-full', over ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, Math.round(b.ratio * 100))}%` }} />
      </div>
      <p className="mt-1 text-xs text-fg-muted">
        {over ? `Excedido por ${formatMoney(-b.remainingMinor, currency)}` : `Disponible: ${formatMoney(b.remainingMinor, currency)}`}
      </p>
    </div>
  );
}

function BudgetForm() {
  const { data, savePreferences } = useData();
  const toast = useToast();
  const prefs = data.preferences;
  const cur = prefs.currency;
  const [open, setOpen] = useState(false);
  const [weekly, setWeekly] = useState(prefs.budgets.weekly ? minorToInput(prefs.budgets.weekly.amountMinor, prefs.budgets.weekly.currency) : '');
  const [monthly, setMonthly] = useState(prefs.budgets.monthly ? minorToInput(prefs.budgets.monthly.amountMinor, prefs.budgets.monthly.currency) : '');
  const [errors, setErrors] = useState<{ weekly?: string; monthly?: string }>({});

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parse = (s: string): { value: Money | null; error?: string } => {
      if (s.trim() === '') return { value: null };
      const r = parseMoneyInput(s, cur);
      if (!r.ok) return { value: null, error: r.error };
      if (r.amountMinor === 0) return { value: null, error: 'Debe ser mayor que cero (o dejalo vacío)' };
      return { value: { amountMinor: r.amountMinor, currency: cur } };
    };
    const w = parse(weekly);
    const m = parse(monthly);
    if (w.error || m.error) {
      setErrors({ weekly: w.error, monthly: m.error });
      return;
    }
    setErrors({});
    try {
      await savePreferences({ ...prefs, budgets: { weekly: w.value, monthly: m.value }, updatedAt: new Date().toISOString() });
      toast('Presupuesto guardado');
      setOpen(false);
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
  }

  if (!open) {
    return (
      <Button size="sm" icon={Pencil} className="mt-4" onClick={() => setOpen(true)}>
        Editar presupuesto
      </Button>
    );
  }
  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 grid gap-3 border-t border-border pt-4">
      <Field label={`Semanal (${cur})`} optional error={errors.weekly} hint="Vacío = sin presupuesto">
        {({ id, describedBy, invalid }) => (
          <input id={id} inputMode="decimal" className="field-input num" value={weekly} onChange={(e) => setWeekly(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <Field label={`Mensual (${cur})`} optional error={errors.monthly}>
        {({ id, describedBy, invalid }) => (
          <input id={id} inputMode="decimal" className="field-input num" value={monthly} onChange={(e) => setMonthly(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" icon={Save}>
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ExpenseForm({ existing, onDone }: { existing?: ExpenseEntry; onDone: () => void }) {
  const { data, save } = useData();
  const toast = useToast();
  const today = useToday();
  const [date, setDate] = useState(existing?.date ?? today);
  const [currency, setCurrency] = useState<Currency>(existing?.amount.currency ?? data.preferences.currency);
  const [amount, setAmount] = useState(existing ? minorToInput(existing.amount.amountMinor, existing.amount.currency) : '');
  const [category, setCategory] = useState<ExpenseCategory>(existing?.category ?? 'product');
  const [qty, setQty] = useState(existing?.quantity ? String(existing.quantity.value).replace('.', ',') : '');
  const [unit, setUnit] = useState<Unit>(existing?.quantity?.unit ?? 'g');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<{ date?: string; amount?: string; qty?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.date = 'Ingresá una fecha válida';
    else if (date > today) errs.date = 'La fecha no puede estar en el futuro';
    const a = parseMoneyInput(amount, currency);
    if (!a.ok) errs.amount = a.error;
    else if (a.amountMinor === 0) errs.amount = 'El importe debe ser mayor que cero';
    let quantity: ExpenseEntry['quantity'] = null;
    if (qty.trim() !== '') {
      const n = parseQuantityInput(qty);
      if (n === null) errs.qty = 'Ingresá un número mayor que cero';
      else quantity = { value: n, unit };
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const now = new Date().toISOString();
    const parsed = expenseEntry.safeParse({
      id: existing?.id ?? newId(),
      schemaVersion: SCHEMA_VERSION,
      date,
      amount: { amountMinor: a.ok ? a.amountMinor : 0, currency },
      category,
      quantity,
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setErrors(issue?.path[0] === 'quantity' ? { qty: issue.message } : { form: issue?.message ?? 'Datos inválidos' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await save('expenses', parsed.data);
      toast(existing ? 'Gasto actualizado' : 'Gasto guardado');
      onDone();
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card animate-rise grid gap-4 p-4 sm:p-5" aria-label={existing ? 'Editar gasto' : 'Nuevo gasto'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{existing ? 'Editar gasto' : 'Nuevo gasto'}</h2>
        <Button size="sm" variant="ghost" icon={X} aria-label="Cerrar formulario" onClick={onDone} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha" error={errors.date}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="date" max={today} className="field-input num" value={date} onChange={(e) => setDate(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        <Field label="Importe" error={errors.amount}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              className="field-input num"
              placeholder={currency === 'CLP' ? 'Ej.: 20.000' : 'Ej.: 15.000,50'}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        <Field label="Moneda">
          {({ id }) => (
            <select id={id} className="field-input" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {t.currencies[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Categoría">
          {({ id }) => (
            <select id={id} className="field-input" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.expenseCategories[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Cantidad comprada" optional error={errors.qty}>
          {({ id, describedBy, invalid }) => (
            <input id={id} inputMode="decimal" className="field-input num" placeholder="Ej.: 5" value={qty} onChange={(e) => setQty(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        <Field label="Unidad de la cantidad">
          {({ id }) => (
            <select id={id} className="field-input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t.units[u].many}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <Field label="Notas" optional>
        {({ id }) => <input id={id} className="field-input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          {errors.form}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" icon={Save} disabled={busy}>
          {existing ? 'Guardar cambios' : 'Guardar gasto'}
        </Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function DeleteExpense({ expense, onClose }: { expense: ExpenseEntry | null; onClose: () => void }) {
  const { remove } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={expense !== null}
      title="¿Eliminar este gasto?"
      confirmLabel="Eliminar gasto"
      busy={busy}
      onCancel={onClose}
      onConfirm={async () => {
        if (!expense) return;
        setBusy(true);
        try {
          await remove('expenses', expense.id);
          toast('Gasto eliminado');
          onClose();
        } catch (err) {
          toast(storageErrorMessage(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      {expense && `${formatMoneyObj(expense.amount)} del ${formatShortDay(expense.date)}. No se puede deshacer.`}
    </ConfirmDialog>
  );
}
