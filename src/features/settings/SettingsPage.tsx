import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BellRing, Download, FileJson, FileSpreadsheet, FlaskConical, KeyRound, LockKeyhole, HardDrive, Link2, Plus, RotateCcw, Save, ShieldCheck, Trash2, TriangleAlert, Upload, X } from 'lucide-react';
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
import { buildDailyReminderIcs, parseTime } from '@/services/reminders';
import { decryptBackup, encryptBackup, isEncryptedBackup, MIN_PASSWORD_LENGTH, shareFile, validatePassword } from '@/services/encryptedBackup';
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
      <PageHeader title="Ajustes y datos" mood="chill" description="Preferencias, copias de seguridad y control total de tus datos locales." />
      <div className="grid gap-4 lg:grid-cols-2">
        <DemoCard />
        <PreferencesCard />
        <RemindersCard />
        <FieldsCard />
        <ReferencePricesCard />
        <StorageCard />
        <DataCard />
        <PrivacyCard />
      </div>
    </>
  );
}

function DemoCard() {
  const { mode, enterDemo, exitDemo, resetDemo } = useData();
  const toast = useToast();
  const link = `${window.location.origin}${window.location.pathname}#/demo`;
  return (
    <Card title="Modo demo" icon={FlaskConical} className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-prose text-sm text-fg-muted">
          {mode === 'demo'
            ? 'Estás viendo 8 semanas de datos de ejemplo inventados. Tus datos reales siguen intactos y vuelven cuando salgas.'
            : 'Mostrale la app a tus amigos con 8 semanas de datos de ejemplo. Se guardan aparte: tus datos reales no se tocan ni se muestran.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {mode === 'demo' ? (
            <>
              <Button size="sm" icon={RotateCcw} onClick={() => void resetDemo().then(() => toast('Demo reiniciada'))}>
                Reiniciar demo
              </Button>
              <Button size="sm" variant="primary" onClick={() => void exitDemo().then(() => toast('Volviste a tus datos reales'))}>
                Salir de la demo
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" icon={FlaskConical} onClick={() => void enterDemo().then(() => toast('Modo demo activado'))}>
              Abrir la demo
            </Button>
          )}
          <Button
            size="sm"
            icon={Link2}
            onClick={() => {
              navigator.clipboard
                ?.writeText(link)
                .then(() => toast('Link de la demo copiado'))
                .catch(() => toast(`Copiá este link: ${link}`));
            }}
          >
            Copiar link de la demo
          </Button>
        </div>
      </div>
    </Card>
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
  const [pw, setPw] = useState<{ kind: 'export' } | { kind: 'import'; text: string } | null>(null);
  const stamp = dayKey(new Date());
  const total = data.consumption.length + data.checkins.length + data.expenses.length + data.goals.length;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setImportError(null);
    try {
      const text = await readFileText(f);
      if (isEncryptedBackup(text)) {
        setPw({ kind: 'import', text });
        return;
      }
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
          <p className="text-xs text-fg-muted">
            El archivo se genera en tu dispositivo. La copia con contraseña está cifrada (AES-256): sirve para pasar tus datos a otro
            celular o compu sin que nadie más pueda leerla.
          </p>
          <Button variant="primary" icon={LockKeyhole} onClick={() => setPw({ kind: 'export' })}>
            Copia con contraseña
          </Button>
          <Button
            icon={FileJson}
            onClick={() => {
              downloadText(`fumometro-copia-${stamp}.json`, exportJson(data), 'application/json');
              toast('Copia JSON generada');
            }}
          >
            Copia sin cifrar (JSON)
          </Button>
          <Button
            icon={FileSpreadsheet}
            disabled={data.consumption.length === 0}
            onClick={() => {
              downloadText(`fumometro-historial-${stamp}.csv`, consumptionCsv(data), 'text/csv;charset=utf-8');
              toast('Historial CSV generado');
            }}
          >
            Historial (CSV)
          </Button>
        </div>
        <div className="grid content-start gap-2">
          <h3 className="text-sm font-medium text-fg">Importar</h3>
          <p className="text-xs text-fg-muted">Copias de esta app, con o sin contraseña. Se valida todo el archivo antes de tocar tus datos.</p>
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

      <PasswordDialog
        mode={pw?.kind ?? null}
        onClose={() => setPw(null)}
        onSubmit={async (password) => {
          if (!pw) return null;
          if (pw.kind === 'export') {
            const enc = await encryptBackup(exportJson(data), password);
            const name = `fumometro-copia-cifrada-${stamp}.json`;
            const shared = await shareFile(name, enc, 'application/json');
            if (!shared) downloadText(name, enc, 'application/json');
            toast('Copia cifrada lista. Guardá la contraseña: sin ella no se puede abrir.');
            setPw(null);
            return null;
          }
          const dec = await decryptBackup(pw.text, password);
          if (!dec.ok) return dec.error;
          const res = parseImport(dec.json);
          setPw(null);
          if (!res.ok) setImportError({ error: res.error, details: res.details });
          else setPending({ data: res.data, file: res.file });
          return null;
        }}
      />

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
          <li>Los datos guardados en el navegador no están cifrados: quien tenga acceso a este navegador y perfil puede verlos. Las copias «con contraseña» sí están cifradas (AES-256) y solo se abren con tu contraseña.</li>
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

function PasswordDialog({
  mode,
  onClose,
  onSubmit,
}: {
  mode: 'export' | 'import' | null;
  onClose: () => void;
  /** Devuelve un mensaje de error o null si salió bien. */
  onSubmit: (password: string) => Promise<string | null>;
}) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword('');
    setRepeat('');
    setError(null);
    onClose();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (mode === 'export') {
      const v = validatePassword(password);
      if (v) return setError(v);
      if (password !== repeat) return setError('Las contraseñas no coinciden.');
    } else if (!password) {
      return setError('Ingresá la contraseña de la copia.');
    }
    setBusy(true);
    setError(null);
    try {
      const err = await onSubmit(password);
      if (err) setError(err);
      else {
        setPassword('');
        setRepeat('');
      }
    } catch {
      setError('No se pudo completar. Intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={mode !== null} title={mode === 'export' ? 'Copia con contraseña' : 'Esta copia tiene contraseña'} onClose={close}>
      <form onSubmit={submit} noValidate className="grid gap-3">
        <p>
          {mode === 'export'
            ? 'Elegí una contraseña. La vas a necesitar para abrir la copia en otro dispositivo. Si la olvidás, no hay forma de recuperarla: ni nosotros podemos.'
            : 'Ingresá la contraseña que usaste al crear la copia.'}
        </p>
        <Field label="Contraseña" error={mode === 'import' ? error : null} hint={mode === 'export' ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` : undefined}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="password"
              autoComplete={mode === 'export' ? 'new-password' : 'current-password'}
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
            />
          )}
        </Field>
        {mode === 'export' && (
          <Field label="Repetí la contraseña" error={error}>
            {({ id, describedBy, invalid }) => (
              <input
                id={id}
                type="password"
                autoComplete="new-password"
                className="field-input"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </Field>
        )}
        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" icon={KeyRound} disabled={busy}>
            {busy ? 'Procesando…' : mode === 'export' ? 'Crear copia' : 'Abrir copia'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function RemindersCard() {
  const toast = useToast();
  const [time, setTime] = useState('21:30');
  const [discreet, setDiscreet] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!parseTime(time)) return setError('Elegí una hora válida.');
    setError(null);
    const ics = buildDailyReminderIcs({ time, discreet, appUrl: `${window.location.origin}${window.location.pathname}` });
    const name = discreet ? 'recordatorio.ics' : 'fumometro-recordatorio.ics';
    const shared = await shareFile(name, ics, 'text/calendar');
    if (!shared) downloadText(name, ics, 'text/calendar;charset=utf-8');
    toast('Abrí el archivo y aceptá agregarlo a tu calendario.');
  }

  return (
    <Card title="Recordatorio diario" icon={BellRing}>
      <p className="mb-4 text-sm text-fg-muted">
        Se agrega como evento repetido en el calendario de tu celular (iPhone o Android) y te avisa todos los días a la hora que elijas.
        No usa servidor ni comparte datos. Para quitarlo, borrá el evento del calendario.
      </p>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr] sm:items-end">
        <Field label="Hora" error={error}>
          {({ id, describedBy, invalid }) => (
            <input id={id} type="time" className="field-input num" value={time} onChange={(e) => setTime(e.target.value)} aria-describedby={describedBy} aria-invalid={invalid} />
          )}
        </Field>
        <label className="flex cursor-pointer items-start gap-2 pb-2 text-sm text-fg">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#b6f36a]" checked={discreet} onChange={(e) => setDiscreet(e.target.checked)} />
          <span>
            Texto discreto <span className="text-fg-subtle">(«Revisar mi bitácora», sin mencionar la app)</span>
          </span>
        </label>
      </div>
      <Button className="mt-4" icon={BellRing} onClick={() => void add()}>
        Agregar a mi calendario
      </Button>
    </Card>
  );
}
