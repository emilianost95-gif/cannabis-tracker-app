import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, FileJson, FileSpreadsheet, HardDrive, Plus, Save, ShieldCheck, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { storageErrorMessage, useToast } from '@/components/Toast';
import { Banner, Button, Card, Field, PageHeader } from '@/components/ui';
import { ConfirmDialog, Dialog } from '@/components/Dialog';
import {
  CURRENCIES,
  METHODS,
  OPTIONAL_FIELDS,
  UNITS,
  type AppData,
  type Currency,
  type ExportFile,
  type Method,
  type OptionalField,
  type ReferencePrice,
  type Unit,
} from '@/domain/model';
import { parseMoneyInput } from '@/domain/money';
import { parseQuantityInput } from '@/domain/quantity';
import { consumptionCsv, downloadText, exportJson, parseImport, readFileText } from '@/services/exportImport';
import { formatMoneyObj, formatNumber, t } from '@/i18n';
import { dayKey } from '@/utils/dates';

const FIELD_LABELS: Record<OptionalField, string> = {
  context: 'Contexto o motivo',
  moodBefore: 'Ánimo antes',
  sleepQuality: 'Calidad del sueño previo',
  stress: 'Estrés percibido',
  cost: 'Gasto asociado',
  notes: 'Notas',
};

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes y datos" description="Preferencias, copias de seguridad y control total de tus datos locales." />
      <div className="grid gap-4 lg:grid-cols-2">
        <PreferencesCard />
        <FieldsCard />
        <ReferencePricesCard />
        <StorageCard />
        <DataCard />
        <PrivacyCard />
      </div>
    </>
  );
}

function PreferencesCard() {
  const { data, savePreferences } = useData();
  const toast = useToast();
  const p = data.preferences;
  const [name, setName] = useState(p.displayName);
  const [currency, setCurrency] = useState<Currency>(p.currency);
  const [method, setMethod] = useState<Method>(p.defaultMethod);
  const [unit, setUnit] = useState<Unit | ''>(p.defaultUnit ?? '');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await savePreferences({
        ...p,
        displayName: name.trim().slice(0, 40),
        currency,
        defaultMethod: method,
        defaultUnit: unit || null,
        updatedAt: new Date().toISOString(),
      });
      toast('Preferencias guardadas');
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
  }

  return (
    <Card title="Preferencias">
      <form onSubmit={onSubmit} className="grid gap-4">
        <Field label="Cómo querés que te salude" optional hint="Solo se usa en el saludo de inicio.">
          {({ id, describedBy }) => (
            <input id={id} className="field-input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-describedby={describedBy} autoComplete="off" />
          )}
        </Field>
        <Field label="Moneda preferida" hint="Los importes en otras monedas se muestran aparte; nunca se convierten.">
          {({ id, describedBy }) => (
            <select id={id} className="field-input" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} aria-describedby={describedBy}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {t.currencies[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Formato por defecto">
            {({ id }) => (
              <select id={id} className="field-input" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {t.methods[m]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Unidad por defecto">
            {({ id }) => (
              <select id={id} className="field-input" value={unit} onChange={(e) => setUnit(e.target.value as Unit | '')}>
                <option value="">Según el formato</option>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {t.units[u].many}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Button type="submit" variant="primary" icon={Save} className="justify-self-start">
          Guardar preferencias
        </Button>
      </form>
    </Card>
  );
}

function FieldsCard() {
  const { data, savePreferences } = useData();
  const toast = useToast();
  const p = data.preferences;

  async function toggle(f: OptionalField, value: boolean) {
    try {
      await savePreferences({ ...p, enabledFields: { ...p.enabledFields, [f]: value }, updatedAt: new Date().toISOString() });
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    }
  }

  return (
    <Card title="Campos del registro">
      <p className="mb-3 text-sm text-fg-muted">Elegí qué campos opcionales ver al registrar. Fecha, formato y cantidad siempre están.</p>
      <ul className="grid gap-1">
        {OPTIONAL_FIELDS.map((f) => (
          <li key={f}>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 py-2 hover:bg-surface-2">
              <span className="text-sm text-fg">{FIELD_LABELS[f]}</span>
              <input type="checkbox" className="size-5 accent-[#b6f36a]" checked={p.enabledFields[f]} onChange={(e) => void toggle(f, e.target.checked)} />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ReferencePricesCard() {
  const { data, savePreferences } = useData();
  const toast = useToast();
  const p = data.preferences;
  const [adding, setAdding] = useState(false);
  const free = UNITS.filter((u) => !p.referencePrices.some((r) => r.unit === u));
  const [unit, setUnit] = useState<Unit>(free[0] ?? 'g');
  const [per, setPer] = useState('1');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<{ per?: string; price?: string }>({});

  async function persist(list: ReferencePrice[], msg: string) {
    try {
      await savePreferences({ ...p, referencePrices: list, updatedAt: new Date().toISOString() });
      toast(msg);
      return true;
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
      return false;
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const q = parseQuantityInput(per);
    const m = parseMoneyInput(price, p.currency);
    const errs: typeof errors = {};
    if (q === null || q > 1000) errs.per = 'Ingresá una cantidad mayor que cero';
    if (!m.ok) errs.price = m.error;
    else if (m.amountMinor === 0) errs.price = 'El precio debe ser mayor que cero';
    if (Object.keys(errs).length || q === null || !m.ok) return setErrors(errs);
    setErrors({});
    const ok = await persist([...p.referencePrices, { unit, perQuantity: q, price: { amountMinor: m.amountMinor, currency: p.currency } }], 'Precio de referencia guardado');
    if (ok) {
      setAdding(false);
      setPrice('');
      setPer('1');
    }
  }

  return (
    <Card title="Precios de referencia">
      <p className="mb-3 text-sm text-fg-muted">
        Sirven para estimar el valor de lo que usás en una sesión. Son estimaciones: nunca se suman al gasto real. Un precio por unidad.
      </p>
      {p.referencePrices.length > 0 && (
        <ul className="mb-3 divide-y divide-border rounded-[var(--radius-md)] border border-border">
          {p.referencePrices.map((r) => (
            <li key={r.unit} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="num">
                {formatMoneyObj(r.price)} por {formatNumber(r.perQuantity, 3)} {t.units[r.unit].short}
              </span>
              <Button
                size="sm"
                variant="ghost"
                icon={Trash2}
                aria-label={`Quitar precio de referencia de ${t.units[r.unit].many}`}
                onClick={() => void persist(p.referencePrices.filter((x) => x.unit !== r.unit), 'Precio de referencia eliminado')}
              />
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <form onSubmit={onAdd} noValidate className="grid gap-3 sm:grid-cols-3">
          <Field label="Unidad">
            {({ id }) => (
              <select id={id} className="field-input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                {free.map((u) => (
                  <option key={u} value={u}>
                    {t.units[u].many}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Cantidad" error={errors.per}>
            {({ id, describedBy, invalid }) => (
              <input id={id} inputMode="decimal" className="field-input num" value={per} onChange={(e) => setPer(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
          <Field label={`Precio (${p.currency})`} error={errors.price}>
            {({ id, describedBy, invalid }) => (
              <input id={id} inputMode="decimal" className="field-input num" value={price} onChange={(e) => setPrice(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
            )}
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" size="sm" variant="primary" icon={Save}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" icon={X} onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        free.length > 0 && (
          <Button
            size="sm"
            icon={Plus}
            onClick={() => {
              setUnit(free[0]!);
              setAdding(true);
            }}
          >
            Agregar precio
          </Button>
        )
      )}
    </Card>
  );
}

function StorageCard() {
  const { storage } = useData();
  const toast = useToast();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.storage?.persist);

  useEffect(() => {
    if (!supported) return;
    navigator.storage.persisted().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      .estimate?.()
      .then((e) => setUsage(e.usage !== undefined ? `${formatNumber(e.usage / 1024, 0)} KB usados por esta app` : null))
      .catch(() => setUsage(null));
  }, [supported]);

  async function request() {
    try {
      const ok = await navigator.storage.persist();
      setPersisted(ok);
      toast(ok ? 'El navegador conservará tus datos aunque falte espacio' : 'El navegador no aceptó la solicitud. Exportá copias periódicamente.', ok ? 'success' : 'error');
    } catch {
      toast('No se pudo solicitar almacenamiento persistente', 'error');
    }
  }

  return (
    <Card title="Almacenamiento" icon={HardDrive}>
      <dl className="grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Dónde se guardan</dt>
          <dd className="text-right text-fg">{storage.kind === 'memory' ? 'Solo en memoria (temporal)' : 'IndexedDB de este navegador'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-fg-muted">Protección ante limpieza automática</dt>
          <dd className="text-right text-fg">{!supported ? 'No disponible en este navegador' : persisted === null ? '—' : persisted ? 'Activada' : 'No activada'}</dd>
        </div>
        {usage && (
          <div className="flex justify-between gap-3">
            <dt className="text-fg-muted">Uso</dt>
            <dd className="num text-right text-fg">{usage}</dd>
          </div>
        )}
      </dl>
      {supported && persisted === false && storage.kind === 'indexeddb' && (
        <Button size="sm" className="mt-4" onClick={() => void request()}>
          Pedir al navegador que conserve los datos
        </Button>
      )}
    </Card>
  );
}

function DataCard() {
  const { data, replaceAll, clearAll } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: AppData; file: ExportFile } | null>(null);
  const [importError, setImportError] = useState<{ error: string; details: string[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearAck, setClearAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const stamp = dayKey(new Date());
  const total = data.consumption.length + data.checkins.length + data.expenses.length + data.goals.length;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setImportError(null);
    try {
      const text = await readFileText(f);
      const res = parseImport(text);
      if (!res.ok) setImportError({ error: res.error, details: res.details });
      else setPending({ data: res.data, file: res.file });
    } catch {
      setImportError({ error: 'No se pudo leer el archivo.', details: [] });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await replaceAll(pending.data);
      toast('Datos importados');
      setPending(null);
    } catch (err) {
      toast(`${storageErrorMessage(err)} Tus datos anteriores no se modificaron.`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doClear() {
    setBusy(true);
    try {
      await clearAll();
      toast('Se eliminaron todos los datos de la app en este navegador');
      setConfirmClear(false);
      setClearAck(false);
    } catch (err) {
      toast(storageErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Copias y eliminación" icon={Download} className="lg:col-span-2">
      <div className="grid gap-5 md:grid-cols-3">
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-medium text-fg">Exportar</h3>
          <p className="text-xs text-fg-muted">El archivo se genera en tu dispositivo y no se envía a ningún lado. Guardalo en un lugar privado: no está cifrado.</p>
          <Button
            icon={FileJson}
            onClick={() => {
              downloadText(`ritmo-copia-${stamp}.json`, exportJson(data), 'application/json');
              toast('Copia JSON generada');
            }}
          >
            Copia completa (JSON)
          </Button>
          <Button
            icon={FileSpreadsheet}
            disabled={data.consumption.length === 0}
            onClick={() => {
              downloadText(`ritmo-historial-${stamp}.csv`, consumptionCsv(data), 'text/csv;charset=utf-8');
              toast('Historial CSV generado');
            }}
          >
            Historial (CSV)
          </Button>
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-medium text-fg">Importar</h3>
          <p className="text-xs text-fg-muted">Solo copias JSON de esta app. Se valida todo el archivo antes de tocar tus datos.</p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="import-file"
            data-testid="import-file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button icon={Upload} onClick={() => fileRef.current?.click()}>
            Elegir archivo…
          </Button>
          {importError && (
            <Banner tone="danger" icon={TriangleAlert} role="alert">
              {importError.error}
              {importError.details.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-xs text-fg-muted">
                  {importError.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </Banner>
          )}
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-medium text-fg">Eliminar todo</h3>
          <p className="text-xs text-fg-muted">Borra registros, gastos, objetivos y preferencias de esta app en este navegador.</p>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmClear(true)}>
            Eliminar todos los datos
          </Button>
        </div>
      </div>

      <Dialog
        open={pending !== null}
        title="¿Reemplazar tus datos con esta copia?"
        onClose={() => setPending(null)}
        footer={
          <>
            <Button onClick={() => setPending(null)} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void confirmImport()} disabled={busy}>
              Reemplazar e importar
            </Button>
          </>
        }
      >
        {pending && (
          <div className="grid gap-2">
            <p>
              La copia es del {new Date(pending.file.meta.exportedAt).toLocaleString(t.locale)} y contiene{' '}
              {pending.file.meta.counts.consumption} registros de consumo, {pending.file.meta.counts.checkins} anotaciones,{' '}
              {pending.file.meta.counts.expenses} gastos y {pending.file.meta.counts.goals} objetivos.
            </p>
            {total > 0 && (
              <p className="text-warn">
                Ahora tenés {total} elementos guardados que serán reemplazados. Si no tenés una copia, exportala antes.
              </p>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmClear}
        title="¿Eliminar todos los datos?"
        confirmLabel="Eliminar todo"
        busy={busy || !clearAck}
        onCancel={() => {
          setConfirmClear(false);
          setClearAck(false);
        }}
        onConfirm={() => void doClear()}
      >
        <div className="grid gap-3">
          <p>
            Se borrarán {total} elementos y tus preferencias. No se puede deshacer. Las copias que hayas exportado y los respaldos del
            sistema o del navegador no se ven afectados.
          </p>
          <label className="flex items-start gap-2 text-fg">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#ff8a80]" checked={clearAck} onChange={(e) => setClearAck(e.target.checked)} />
            Entiendo que esta acción es definitiva.
          </label>
        </div>
      </ConfirmDialog>
    </Card>
  );
}

function PrivacyCard() {
  return (
    <Card title="Política de datos" icon={ShieldCheck} className="lg:col-span-2">
      <div className="grid gap-3 text-sm text-fg-muted md:grid-cols-2">
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>No hay cuenta ni servidor: todo se guarda en el almacenamiento local (IndexedDB) de este navegador.</li>
          <li>La app no envía tus registros a terceros, no tiene publicidad ni analíticas, y no incluye SDKs externos.</li>
          <li>Las direcciones de las pantallas solo contienen identificadores aleatorios, nunca datos de consumo.</li>
          <li>Los datos no están cifrados por la app: quien tenga acceso a este navegador y perfil puede verlos.</li>
        </ul>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li>«Eliminar todo» borra los datos de la app en este navegador. No puede borrar archivos exportados, respaldos del sistema operativo o copias que el navegador sincronice por su cuenta.</li>
          <li>Si borrás los datos de navegación del sitio, también se borran tus registros. Exportá copias periódicamente.</li>
          <li>Cada navegador y cada dispositivo tienen su propio almacenamiento: los datos no se sincronizan entre ellos.</li>
          <li>Esta app no ofrece consejo médico ni diagnósticos.</li>
        </ul>
      </div>
    </Card>
  );
}
