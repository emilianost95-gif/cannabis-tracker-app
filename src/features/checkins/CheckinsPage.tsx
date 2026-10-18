import { useState, type FormEvent } from 'react';
import { NotebookPen, Pencil, Save, Trash2 } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Badge, Button, Card, EmptyState, Field, PageHeader, ScalePicker, cx } from '@/components/ui';
import { ConfirmDialog } from '@/components/Dialog';
import { CONTEXTS, SCHEMA_VERSION, moodCheckIn, type Context, type MoodCheckIn } from '@/domain/model';
import { FUTURE_TOLERANCE_MS } from '@/domain/entries';
import { capitalize, formatDateTime, t } from '@/i18n';
import { isoToLocalInput, localInputToIso } from '@/utils/dates';
import { newId } from '@/utils/id';

export function CheckinsPage() {
  const { data } = useData();
  const [editing, setEditing] = useState<MoodCheckIn | null>(null);
  const [toDelete, setToDelete] = useState<MoodCheckIn | null>(null);
  const sorted = [...data.checkins].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <>
      <PageHeader
        title="Registro personal"
        mood="chill"
        description="Un espacio breve para anotar cómo estás, consumas o no. Todo es opcional y sirve para observar patrones con el tiempo; no genera diagnósticos."
      />
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr] lg:items-start">
        <CheckinForm key={editing?.id ?? 'new'} existing={editing ?? undefined} onDone={() => setEditing(null)} />
        <Card title="Anotaciones anteriores">
          {sorted.length === 0 ? (
            <EmptyState compact icon={NotebookPen} mood="chill" title="Sin anotaciones todavía">
              Cuando tengas varias, en Estadísticas vas a poder compararlas con los días con y sin consumo.
            </EmptyState>
          ) : (
            <ul className="-mx-1 divide-y divide-border">
              {sorted.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-fg-subtle">{capitalize(formatDateTime(c.occurredAt))}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.mood !== null && <Badge>Ánimo {c.mood}/5</Badge>}
                      {c.stress !== null && <Badge>Estrés {c.stress}/5</Badge>}
                      {c.sleep !== null && <Badge>Sueño {c.sleep}/5</Badge>}
                      {c.craving !== null && <Badge>Deseo {c.craving}/4</Badge>}
                      {c.reason && <Badge tone="cyan">{t.contexts[c.reason]}</Badge>}
                    </div>
                    {c.notes && <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-fg-muted">{c.notes}</p>}
                  </div>
                  <Button size="sm" variant="ghost" icon={Pencil} aria-label="Editar anotación" onClick={() => setEditing(c)} />
                  <Button size="sm" variant="ghost" icon={Trash2} aria-label="Eliminar anotación" onClick={() => setToDelete(c)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <DeleteCheckin item={toDelete} onClose={() => setToDelete(null)} />
    </>
  );
}

function CheckinForm({ existing, onDone }: { existing?: MoodCheckIn; onDone: () => void }) {
  const { save } = useData();
  const toast = useToast();
  const [when, setWhen] = useState(isoToLocalInput(existing?.occurredAt ?? new Date().toISOString()));
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
  const [sleep, setSleep] = useState<number | null>(existing?.sleep ?? null);
  const [craving, setCraving] = useState<number | null>(existing?.craving ?? null);
  const [reason, setReason] = useState<Context | null>(existing?.reason ?? null);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [whenError, setWhenError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setWhen(isoToLocalInput(new Date().toISOString()));
    setMood(null);
    setStress(null);
    setSleep(null);
    setCraving(null);
    setReason(null);
    setNotes('');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const iso = localInputToIso(when);
    if (!iso) return setWhenError('Ingresá una fecha y hora válidas');
    if (Date.parse(iso) > Date.now() + FUTURE_TOLERANCE_MS) return setWhenError('La fecha no puede estar en el futuro');
    setWhenError(null);
    const now = new Date().toISOString();
    const parsed = moodCheckIn.safeParse({
      id: existing?.id ?? newId(),
      schemaVersion: SCHEMA_VERSION,
      occurredAt: iso,
      mood,
      stress,
      sleep,
      craving,
      reason,
      notes: notes.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await save('checkins', parsed.data);
      toast(existing ? 'Anotación actualizada' : 'Anotación guardada');
      if (!existing) reset();
      onDone();
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card grid gap-4 p-4 sm:p-5" aria-label={existing ? 'Editar anotación' : 'Nueva anotación'}>
      <h2 className="text-sm font-semibold">{existing ? 'Editar anotación' : '¿Cómo estás?'}</h2>
      <Field label="Fecha y hora" error={whenError}>
        {({ id, describedBy, invalid }) => (
          <input id={id} type="datetime-local" className="field-input num" value={when} onChange={(e) => setWhen(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </Field>
      <ScalePicker legend="Ánimo" value={mood} onChange={setMood} labels={t.scales.mood} />
      <ScalePicker legend="Estrés" value={stress} onChange={setStress} labels={t.scales.stress} />
      <ScalePicker legend="Sueño de anoche" value={sleep} onChange={setSleep} labels={t.scales.sleep} />
      <ScalePicker legend="Deseo de consumir" value={craving} onChange={setCraving} labels={t.scales.craving} min={0} />
      <Field label="Motivo o situación" optional>
        {({ id }) => (
          <select id={id} className="field-input" value={reason ?? ''} onChange={(e) => setReason((e.target.value || null) as Context | null)}>
            <option value="">Sin indicar</option>
            {CONTEXTS.map((c) => (
              <option key={c} value={c}>
                {t.contexts[c]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Observaciones" optional>
        {({ id }) => (
          <textarea id={id} rows={3} maxLength={1000} className="field-input resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className={cx('flex gap-2', existing ? '' : 'flex-col')}>
        <Button type="submit" variant="primary" icon={Save} disabled={busy}>
          {existing ? 'Guardar cambios' : 'Guardar anotación'}
        </Button>
        {existing && (
          <Button variant="ghost" onClick={onDone} disabled={busy}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}

function DeleteCheckin({ item, onClose }: { item: MoodCheckIn | null; onClose: () => void }) {
  const { remove } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <ConfirmDialog
      open={item !== null}
      title="¿Eliminar esta anotación?"
      confirmLabel="Eliminar"
      busy={busy}
      onCancel={onClose}
      onConfirm={async () => {
        if (!item) return;
        setBusy(true);
        try {
          await remove('checkins', item.id);
          toast('Anotación eliminada');
          onClose();
        } catch (err) {
          toast(storageErrorMessage(err), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      No se puede deshacer.
    </ConfirmDialog>
  );
}
