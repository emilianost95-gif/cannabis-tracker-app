import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Trash2, FileQuestion, ChevronDown } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToast, storageErrorMessage } from '@/components/Toast';
import { Button, EmptyState, Field, LinkButton, PageHeader, ScalePicker, Segmented, cx } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { CONTEXTS, METHODS, UNITS, type ConsumptionEntry, type Method, type Unit } from '@/domain/model';
import {
  buildConsumptionEntry,
  estimateCost,
  findPossibleDuplicate,
  type ConsumptionFormValues,
  type CostMode,
  type FormErrors,
} from '@/domain/entries';
import { minorToInput } from '@/domain/money';
import { parseQuantityInput } from '@/domain/quantity';
import { formatDateTime, formatMoneyObj, t } from '@/i18n';
import { isoToLocalInput } from '@/utils/dates';
import { newId } from '@/utils/id';

/** Unidad sugerida al elegir un formato. Solo una sugerencia; la persona decide. */
const SUGGESTED_UNIT: Record<Method, Unit> = {
  flower_smoked: 'g',
  flower_vaporized: 'g',
  vape_cartridge: 'puff',
  edible: 'piece',
  concentrate: 'g',
  tincture: 'drop',
  other: 'g',
};

function initialValues(existing: ConsumptionEntry | undefined, defaults: { method: Method; unit: Unit | null; currency: ConsumptionFormValues['currency'] }): ConsumptionFormValues {
  if (existing) {
    return {
      occurredAtLocal: isoToLocalInput(existing.occurredAt),
      method: existing.method,
      quantityText: existing.quantity ? String(existing.quantity.value).replace('.', ',') : '',
      unit: existing.quantity?.unit ?? null,
      context: existing.context,
      moodBefore: existing.moodBefore,
      sleepQuality: existing.sleepQuality,
      stress: existing.stress,
      costMode: existing.cost?.kind ?? 'none',
      costText: existing.cost?.kind === 'paid' ? minorToInput(existing.cost.amountMinor, existing.cost.currency) : '',
      currency: existing.cost?.currency ?? defaults.currency,
      notes: existing.notes,
    };
  }
  return {
    occurredAtLocal: isoToLocalInput(new Date().toISOString()),
    method: defaults.method,
    quantityText: '',
    unit: defaults.unit ?? SUGGESTED_UNIT[defaults.method],
    context: null,
    moodBefore: null,
    sleepQuality: null,
    stress: null,
    costMode: 'none',
    costText: '',
    currency: defaults.currency,
    notes: '',
  };
}

export function RegisterPage() {
  const { id } = useParams();
  const { data } = useData();
  const existing = id ? data.consumption.find((e) => e.id === id) : undefined;

  if (id && !existing) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Este registro no existe"
        action={
          <LinkButton to="/historial" variant="primary">
            Ir al historial
          </LinkButton>
        }
      >
        Puede que se haya eliminado.
      </EmptyState>
    );
  }
  // `key` reinicia el formulario al pasar de editar a crear.
  return <ConsumptionForm key={existing?.id ?? 'new'} existing={existing} />;
}

function ConsumptionForm({ existing }: { existing?: ConsumptionEntry }) {
  const { data, save, remove } = useData();
  const prefs = data.preferences;
  const fields = prefs.enabledFields;
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState<ConsumptionFormValues>(() =>
    initialValues(existing, { method: prefs.defaultMethod, unit: prefs.defaultUnit, currency: prefs.currency }),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{ entry: ConsumptionEntry; other: ConsumptionEntry } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showState, setShowState] = useState(
    Boolean(existing && (existing.moodBefore ?? existing.sleepQuality ?? existing.stress) !== null),
  );

  const set = <K extends keyof ConsumptionFormValues>(k: K, val: ConsumptionFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const parsedQty = parseQuantityInput(v.quantityText);
  const estimate = useMemo(
    () => (parsedQty !== null && v.unit ? estimateCost({ value: parsedQty, unit: v.unit }, prefs.referencePrices) : null),
    [parsedQty, v.unit, prefs.referencePrices],
  );
  const refForUnit = v.unit ? prefs.referencePrices.find((r) => r.unit === v.unit) : undefined;

  async function persist(entry: ConsumptionEntry) {
    setBusy(true);
    try {
      await save('consumption', entry);
      toast(existing ? 'Registro actualizado' : 'Registro guardado');
      navigate(existing ? `/historial/${entry.id}` : '/');
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = buildConsumptionEntry(v, { existing, referencePrices: prefs.referencePrices, now: new Date(), id: newId() });
    if (!res.ok) {
      setErrors(res.errors);
      const firstKey = Object.keys(res.errors)[0];
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-field="${firstKey}"] input, [data-field="${firstKey}"] select`)?.focus());
      return;
    }
    setErrors({});
    const dup = findPossibleDuplicate(data.consumption, res.entry);
    if (dup && !existing) {
      setPendingDuplicate({ entry: res.entry, other: dup });
      return;
    }
    void persist(res.entry);
  }

  async function onDelete() {
    if (!existing) return;
    setBusy(true);
    try {
      await remove('consumption', existing.id);
      toast('Registro eliminado');
      navigate('/historial');
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
      setBusy(false);
    }
  }

  const costOptions: { value: CostMode; label: string }[] = [
    { value: 'none', label: 'Sin importe' },
    { value: 'paid', label: 'Pagué en el momento' },
    { value: 'estimated', label: 'Estimar valor' },
  ];

  return (
    <>
      <PageHeader
        title={existing ? 'Editar sesión' : 'Anotar sesión'}
        description={existing ? `Registrado el ${formatDateTime(existing.occurredAt)}` : 'Solo la fecha y el formato son obligatorios. Lo demás, si pinta.'}
      />
      <form onSubmit={onSubmit} noValidate className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="card grid gap-5 p-4 sm:p-6">
          <div data-field="occurredAt">
            <Field label="Fecha y hora" error={errors.occurredAt}>
              {({ id, describedBy, invalid }) => (
                <input
                  id={id}
                  type="datetime-local"
                  className="field-input num sm:max-w-xs"
                  value={v.occurredAtLocal}
                  onChange={(e) => set('occurredAtLocal', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  required
                />
              )}
            </Field>
          </div>

          <Segmented
            legend="Formato"
            value={v.method}
            onChange={(m) => {
              setV((s) => ({ ...s, method: m, unit: s.quantityText.trim() === '' ? SUGGESTED_UNIT[m] : s.unit }));
            }}
            options={METHODS.map((m) => ({ value: m, label: t.methods[m] }))}
          />

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <div data-field="quantity">
              <Field
                label="Cantidad"
                optional
                error={errors.quantity}
                hint="Si no la sabés, dejala vacía: se guarda como sesión sin cantidad."
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    className="field-input num"
                    placeholder="Ej.: 0,5"
                    value={v.quantityText}
                    onChange={(e) => set('quantityText', e.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              </Field>
            </div>
            <div data-field="unit">
              <Field label="Unidad" error={errors.unit} hint="Las unidades nunca se mezclan ni se convierten.">
                {({ id, describedBy, invalid }) => (
                  <select
                    id={id}
                    className="field-input"
                    value={v.unit ?? ''}
                    onChange={(e) => set('unit', (e.target.value || null) as Unit | null)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  >
                    <option value="">Elegir unidad…</option>
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {t.units[u].many} ({t.units[u].short})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </div>

          {fields.context && (
            <Segmented
              legend="Contexto o motivo (opcional)"
              value={v.context ?? ('none' as const)}
              onChange={(c) => set('context', c === 'none' ? null : c)}
              size="sm"
              options={[{ value: 'none' as const, label: 'Sin indicar' }, ...CONTEXTS.map((c) => ({ value: c, label: t.contexts[c] }))]}
            />
          )}

          {(fields.moodBefore || fields.sleepQuality || fields.stress) && (
            <div className="rounded-[var(--radius-md)] border border-border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-medium text-fg"
                aria-expanded={showState}
                onClick={() => setShowState((s) => !s)}
              >
                <span>
                  Cómo estabas antes <span className="font-normal text-fg-subtle">(opcional)</span>
                </span>
                <ChevronDown aria-hidden size={18} className={cx('text-fg-subtle transition-transform', showState && 'rotate-180')} />
              </button>
              {showState && (
                <div className="grid gap-4 border-t border-border p-3">
                  {fields.moodBefore && (
                    <ScalePicker legend="Ánimo" value={v.moodBefore} onChange={(x) => set('moodBefore', x)} labels={t.scales.mood} />
                  )}
                  {fields.sleepQuality && (
                    <ScalePicker legend="Calidad del sueño previo" value={v.sleepQuality} onChange={(x) => set('sleepQuality', x)} labels={t.scales.sleep} />
                  )}
                  {fields.stress && (
                    <ScalePicker legend="Estrés percibido" value={v.stress} onChange={(x) => set('stress', x)} labels={t.scales.stress} />
                  )}
                </div>
              )}
            </div>
          )}

          {fields.notes && (
            <div data-field="notes">
              <Field label="Notas" optional error={errors.notes} hint={`${v.notes.length}/1000`}>
                {({ id, describedBy, invalid }) => (
                  <textarea
                    id={id}
                    rows={3}
                    maxLength={1000}
                    className="field-input resize-y"
                    value={v.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    aria-describedby={describedBy}
                    aria-invalid={invalid}
                  />
                )}
              </Field>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:sticky lg:top-10">
          {fields.cost && (
            <div className="card grid gap-4 p-4 sm:p-5" data-field="cost">
              <Segmented legend="Gasto asociado (opcional)" value={v.costMode} onChange={(m) => set('costMode', m)} options={costOptions} size="sm" />
              {v.costMode === 'paid' && (
                <Field
                  label={`Importe pagado (${v.currency})`}
                  error={errors.cost}
                  hint="Cuenta como gasto real. Si ya registraste esta compra en Gastos, usá «Estimar valor» para no contarla dos veces."
                >
                  {({ id, describedBy, invalid }) => (
                    <input
                      id={id}
                      inputMode="decimal"
                      autoComplete="off"
                      className="field-input num"
                      placeholder={v.currency === 'CLP' ? 'Ej.: 5.000' : 'Ej.: 2.500,50'}
                      value={v.costText}
                      onChange={(e) => set('costText', e.target.value)}
                      aria-describedby={describedBy}
                      aria-invalid={invalid}
                    />
                  )}
                </Field>
              )}
              {v.costMode === 'estimated' && (
                <div className="text-sm" role="status">
                  {estimate ? (
                    <p className="text-fg">
                      Valor estimado: <strong className="num">{formatMoneyObj(estimate)}</strong>
                      <span className="mt-1 block text-xs text-fg-subtle">
                        Según tu precio de referencia. Es una estimación: no se suma al gasto real.
                      </span>
                    </p>
                  ) : (
                    <p className={errors.cost ? 'text-danger' : 'text-fg-muted'}>
                      {!refForUnit
                        ? `No hay precio de referencia para ${v.unit ? t.units[v.unit].many : 'esta unidad'}. Podés definirlo en Ajustes.`
                        : 'Ingresá una cantidad para calcular la estimación.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {errors.form && (
            <p role="alert" className="text-sm text-danger">
              {errors.form}
            </p>
          )}
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="text-sm text-danger lg:order-last">
              Revisá los campos marcados.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            <Button type="submit" variant="primary" icon={Save} disabled={busy} className="sm:flex-1">
              {existing ? 'Guardar cambios' : 'Guardar registro'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(-1)} disabled={busy} className="sm:flex-1">
              Cancelar
            </Button>
            {existing && (
              <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={busy}>
                Eliminar
              </Button>
            )}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={pendingDuplicate !== null}
        title="¿Es un registro repetido?"
        confirmLabel="Guardar igual"
        danger={false}
        busy={busy}
        onCancel={() => setPendingDuplicate(null)}
        onConfirm={() => {
          const entry = pendingDuplicate?.entry;
          setPendingDuplicate(null);
          if (entry) void persist(entry);
        }}
      >
        Ya hay un registro de {pendingDuplicate ? t.methods[pendingDuplicate.other.method].toLowerCase() : ''} con la misma cantidad el{' '}
        {pendingDuplicate ? formatDateTime(pendingDuplicate.other.occurredAt) : ''}. Si es una sesión distinta, guardalo igual.
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar este registro?"
        confirmLabel="Eliminar registro"
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void onDelete()}
      >
        Se borrará de este dispositivo y las estadísticas se recalcularán. No se puede deshacer.
      </ConfirmDialog>
    </>
  );
}
